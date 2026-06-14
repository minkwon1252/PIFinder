-- =============================================================================
-- PIFinder — initial schema (Phase 1)
-- Postgres / Supabase. Idempotent-ish: safe to run on a fresh project.
--
-- Conventions:
--   * Every user-owned table has user_id uuid references auth.users.
--   * RLS is enabled on EVERY table. User-owned tables: owner-only access.
--   * Reference/global tables (schools, departments, professors, ...): readable
--     by any authenticated member, writable only by admins.
--   * Helper functions public.is_admin() / public.is_member() drive policies.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$ begin
  create type app_role as enum ('member', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type target_degree as enum ('MS', 'PhD', 'MS_PhD', 'undecided');
exception when duplicate_object then null; end $$;

do $$ begin
  create type research_method as enum ('experimental', 'computational', 'theoretical', 'mixed', 'unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type school_tier as enum ('reach', 'target', 'foundation');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pi_finder_mode as enum ('department_list', 'ultimate_match');
exception when duplicate_object then null; end $$;

do $$ begin
  create type evidence_kind as enum ('verified_fact', 'inferred_fit', 'user_provided', 'missing_uncertain');
exception when duplicate_object then null; end $$;

-- =============================================================================
-- AUTH / MEMBERSHIP
-- =============================================================================

-- The admin-maintained STEM allowlist. Membership gate checks this table.
create table if not exists public.member_allowlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  note        text,
  added_by    uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- One profile row per authenticated user.
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text not null,
  full_name         text,
  role              app_role not null default 'member',
  -- Onboarding research profile fields:
  target_degree     target_degree not null default 'undecided',
  method_preference research_method not null default 'unknown',
  application_area  text,
  project_summary   text,
  onboarded_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so policies can read profiles safely).
-- Defined after public.profiles so their bodies validate at creation time.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
  );
$$;

create table if not exists public.user_majors (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  is_primary  boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.user_interests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  keyword     text not null,
  created_at  timestamptz not null default now()
);

-- CV / project documents. Files live in a PRIVATE storage bucket; this table
-- only stores metadata + the storage path.
create table if not exists public.uploaded_documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  kind          text not null default 'cv', -- 'cv' | 'project' | 'other'
  file_name     text not null,
  storage_path  text not null,             -- path within the private 'cvs' bucket
  mime_type     text,
  size_bytes    bigint,
  created_at    timestamptz not null default now()
);

-- =============================================================================
-- REFERENCE DATA (admin-managed, member-readable)
-- =============================================================================

create table if not exists public.schools (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  short_name    text,
  country       text not null default 'USA',
  admissions_url text,
  created_at    timestamptz not null default now()
);

create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  abbrev      text,
  field       text,                          -- e.g. 'engineering', 'science'
  created_at  timestamptz not null default now(),
  unique (name)
);

create table if not exists public.school_departments (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools (id) on delete cascade,
  department_id  uuid not null references public.departments (id) on delete cascade,
  faculty_url    text,
  created_at     timestamptz not null default now(),
  unique (school_id, department_id)
);

create table if not exists public.professors (
  id                  uuid primary key default gen_random_uuid(),
  full_name           text not null,
  research_identity   text,                  -- one-sentence research identity
  homepage_url        text,
  lab_name            text,
  lab_url             text,
  openalex_id         text,
  orcid               text,
  semantic_scholar_id text,
  research_themes     text[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.professor_affiliations (
  id             uuid primary key default gen_random_uuid(),
  professor_id   uuid not null references public.professors (id) on delete cascade,
  school_id      uuid references public.schools (id) on delete set null,
  department_id  uuid references public.departments (id) on delete set null,
  title          text,                       -- e.g. 'Associate Professor'
  is_primary     boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Every professor claim must be traceable to a source record.
create table if not exists public.professor_sources (
  id              uuid primary key default gen_random_uuid(),
  professor_id    uuid not null references public.professors (id) on delete cascade,
  source_type     text not null,             -- 'department_page' | 'lab_page' | 'admissions' | 'openalex' | 'semantic_scholar' | 'crossref' | 'orcid'
  source_url      text,
  retrieved_at    timestamptz not null default now(),
  confidence      numeric(3,2) not null default 0.50, -- 0..1
  raw_excerpt     text,
  created_at      timestamptz not null default now()
);

create table if not exists public.professor_metrics (
  id              uuid primary key default gen_random_uuid(),
  professor_id    uuid not null references public.professors (id) on delete cascade,
  citation_count  integer,
  h_index         integer,
  works_count     integer,
  source_id       uuid references public.professor_sources (id) on delete set null,
  as_of           timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create table if not exists public.papers (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  doi          text,
  openalex_id  text,
  year         integer,
  venue        text,
  citation_count integer,
  url          text,
  created_at   timestamptz not null default now()
);

create table if not exists public.professor_papers (
  id            uuid primary key default gen_random_uuid(),
  professor_id  uuid not null references public.professors (id) on delete cascade,
  paper_id      uuid not null references public.papers (id) on delete cascade,
  is_influential boolean not null default false,
  is_recent     boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (professor_id, paper_id)
);

create table if not exists public.lab_members (
  id            uuid primary key default gen_random_uuid(),
  professor_id  uuid not null references public.professors (id) on delete cascade,
  name          text not null,
  role          text,                         -- 'PhD student' | 'postdoc' | ...
  research_note text,
  source_id     uuid references public.professor_sources (id) on delete set null,
  created_at    timestamptz not null default now()
);

-- =============================================================================
-- USER WORKFLOW DATA (owner-only)
-- =============================================================================

-- A user's target school selection with tier (reach/target/foundation).
create table if not exists public.applications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  school_id   uuid not null references public.schools (id) on delete cascade,
  tier        school_tier not null default 'target',
  status      text not null default 'planned',
  created_at  timestamptz not null default now(),
  unique (user_id, school_id)
);

-- A single PI Finder execution.
create table if not exists public.search_runs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  mode         pi_finder_mode not null default 'department_list',
  status       text not null default 'running', -- running | complete | failed
  params       jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.candidate_professors (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  search_run_id uuid not null references public.search_runs (id) on delete cascade,
  professor_id  uuid not null references public.professors (id) on delete cascade,
  school_id     uuid references public.schools (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  total_score   numeric(5,2) not null default 0,
  rank          integer,
  is_ultimate_match boolean not null default false,
  fit_reason    text,
  mismatch_risk text,
  created_at    timestamptz not null default now()
);

-- Explainable score components (store components, not just the total).
create table if not exists public.candidate_scores (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  candidate_id          uuid not null references public.candidate_professors (id) on delete cascade,
  keyword_fit           numeric(5,2) not null default 0,
  method_fit            numeric(5,2) not null default 0,
  application_domain_fit numeric(5,2) not null default 0,
  publication_recency   numeric(5,2) not null default 0,
  project_overlap       numeric(5,2) not null default 0,
  dept_school_match     numeric(5,2) not null default 0,
  lab_activity          numeric(5,2) not null default 0,
  mentorship_proxy      numeric(5,2) not null default 0,
  risk_penalty          numeric(5,2) not null default 0,
  explanation           jsonb not null default '{}',
  created_at            timestamptz not null default now()
);

create table if not exists public.screening_questions (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,
  prompt       text not null,
  options      jsonb not null default '[]',
  weight_hint  jsonb not null default '{}',
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.screening_answers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  search_run_id uuid not null references public.search_runs (id) on delete cascade,
  question_key  text not null,
  answer        text not null,
  effect_note   text,                         -- what changed after this answer
  created_at    timestamptz not null default now()
);

create table if not exists public.eliminated_candidates (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  candidate_id  uuid not null references public.candidate_professors (id) on delete cascade,
  reason        text,
  created_at    timestamptz not null default now(),
  unique (candidate_id)
);

create table if not exists public.revived_candidates (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  candidate_id  uuid not null references public.candidate_professors (id) on delete cascade,
  new_info      text not null,                -- what makes them relevant again
  old_rank      integer,
  new_rank      integer,
  created_at    timestamptz not null default now()
);

create table if not exists public.shortlists (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  candidate_id  uuid not null references public.candidate_professors (id) on delete cascade,
  note          text,
  created_at    timestamptz not null default now(),
  unique (user_id, candidate_id)
);

create table if not exists public.story_plans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  candidate_id    uuid not null references public.candidate_professors (id) on delete cascade,
  sop_angle       text,
  school_reason   text,
  department_reason text,
  cv_connection   text,
  email_talking_points text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, candidate_id)
);

create table if not exists public.recommended_readings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  candidate_id  uuid references public.candidate_professors (id) on delete cascade,
  paper_id      uuid references public.papers (id) on delete set null,
  title         text not null,
  url           text,
  reason        text,
  created_at    timestamptz not null default now()
);

create table if not exists public.skill_gap_recommendations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  candidate_id  uuid references public.candidate_professors (id) on delete cascade,
  skill         text not null,
  why           text,
  how_to_improve text,
  created_at    timestamptz not null default now()
);

-- =============================================================================
-- SECRETARY (deadlines)
-- =============================================================================

create table if not exists public.deadlines (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools (id) on delete cascade,
  department_id   uuid references public.departments (id) on delete set null,
  term            text,                       -- e.g. 'Fall 2027'
  application_deadline date,
  priority_deadline    date,
  financial_aid_deadline date,
  required_documents text[],
  english_requirement text,                   -- TOEFL/IELTS notes
  gre_status      text,                       -- required | optional | not accepted
  application_fee text,
  portal_url      text,
  last_checked_at timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.deadline_sources (
  id            uuid primary key default gen_random_uuid(),
  deadline_id   uuid not null references public.deadlines (id) on delete cascade,
  source_url    text not null,
  retrieved_at  timestamptz not null default now(),
  confidence    numeric(3,2) not null default 0.50,
  created_at    timestamptz not null default now()
);

-- =============================================================================
-- ENG TRAINER
-- =============================================================================

create table if not exists public.toefl_practice_sets (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  prompt      text not null,
  kind        text not null default 'writing', -- 'writing' | 'speaking'
  time_limit_seconds integer,
  created_at  timestamptz not null default now()
);

create table if not exists public.toefl_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  practice_set_id uuid references public.toefl_practice_sets (id) on delete set null,
  prompt          text,
  response_text   text,
  timed           boolean not null default false,
  duration_seconds integer,
  score_estimate  numeric(4,1),
  feedback        jsonb not null default '{}', -- structure/grammar/clarity/tone/vocab/argument
  created_at      timestamptz not null default now()
);

create table if not exists public.typing_practice_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  wpm         numeric(5,1),
  accuracy    numeric(5,2),
  duration_seconds integer,
  sample_text text,
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- AUDIT LOG (admin actions + expensive-run usage tracking)
-- =============================================================================

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,                  -- e.g. 'allowlist.add', 'search_run.create'
  entity      text,                           -- table/entity name
  entity_id   text,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Useful indexes
-- -----------------------------------------------------------------------------
create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_user_majors_user on public.user_majors (user_id);
create index if not exists idx_user_interests_user on public.user_interests (user_id);
create index if not exists idx_uploaded_documents_user on public.uploaded_documents (user_id);
create index if not exists idx_applications_user on public.applications (user_id);
create index if not exists idx_search_runs_user on public.search_runs (user_id);
create index if not exists idx_candidates_run on public.candidate_professors (search_run_id);
create index if not exists idx_candidates_user on public.candidate_professors (user_id);
create index if not exists idx_scores_candidate on public.candidate_scores (candidate_id);
create index if not exists idx_prof_affil_prof on public.professor_affiliations (professor_id);
create index if not exists idx_prof_sources_prof on public.professor_sources (professor_id);
create index if not exists idx_deadlines_school on public.deadlines (school_id);
create index if not exists idx_audit_actor on public.audit_logs (actor_id);

-- =============================================================================
-- updated_at trigger
-- =============================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_professors_updated on public.professors;
create trigger trg_professors_updated before update on public.professors
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_story_updated on public.story_plans;
create trigger trg_story_updated before update on public.story_plans
  for each row execute function public.touch_updated_at();
