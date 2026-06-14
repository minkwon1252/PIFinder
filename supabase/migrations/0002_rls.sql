-- =============================================================================
-- PIFinder — Row Level Security policies
-- Run AFTER 0001_init.sql.
--
-- Model:
--   * Enable RLS on every table.
--   * Owner-only tables: USING (user_id = auth.uid()).
--   * Reference tables: SELECT for any authenticated member; write for admins.
--   * profiles: a user may read/update their own row; admins read all.
--   * member_allowlist + audit_logs: admin-only (allowlist is also read during
--     the membership gate via the service role, which bypasses RLS).
-- =============================================================================

-- Enable RLS everywhere.
alter table public.member_allowlist        enable row level security;
alter table public.profiles                enable row level security;
alter table public.user_majors             enable row level security;
alter table public.user_interests          enable row level security;
alter table public.uploaded_documents      enable row level security;
alter table public.schools                 enable row level security;
alter table public.departments             enable row level security;
alter table public.school_departments      enable row level security;
alter table public.professors              enable row level security;
alter table public.professor_affiliations  enable row level security;
alter table public.professor_sources       enable row level security;
alter table public.professor_metrics       enable row level security;
alter table public.papers                  enable row level security;
alter table public.professor_papers        enable row level security;
alter table public.lab_members             enable row level security;
alter table public.applications            enable row level security;
alter table public.search_runs             enable row level security;
alter table public.candidate_professors    enable row level security;
alter table public.candidate_scores        enable row level security;
alter table public.screening_questions     enable row level security;
alter table public.screening_answers       enable row level security;
alter table public.eliminated_candidates   enable row level security;
alter table public.revived_candidates      enable row level security;
alter table public.shortlists              enable row level security;
alter table public.story_plans             enable row level security;
alter table public.recommended_readings    enable row level security;
alter table public.skill_gap_recommendations enable row level security;
alter table public.deadlines               enable row level security;
alter table public.deadline_sources        enable row level security;
alter table public.toefl_practice_sets     enable row level security;
alter table public.toefl_attempts          enable row level security;
alter table public.typing_practice_attempts enable row level security;
alter table public.audit_logs              enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Inserts happen via service role (membership gate). No public insert policy.
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- member_allowlist — admin only (gate reads it via service role)
-- -----------------------------------------------------------------------------
drop policy if exists allowlist_admin_all on public.member_allowlist;
create policy allowlist_admin_all on public.member_allowlist
  for all using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Owner-only tables — generated policies
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  owner_tables text[] := array[
    'user_majors','user_interests','uploaded_documents','applications',
    'search_runs','candidate_professors','candidate_scores','screening_answers',
    'eliminated_candidates','revived_candidates','shortlists','story_plans',
    'recommended_readings','skill_gap_recommendations','toefl_attempts',
    'typing_practice_attempts'
  ];
begin
  foreach t in array owner_tables loop
    execute format('drop policy if exists %I_owner_all on public.%I;', t, t);
    execute format(
      'create policy %I_owner_all on public.%I for all
         using (user_id = auth.uid())
         with check (user_id = auth.uid());', t, t);
    -- Admins may read owner data for support/debug (read-only).
    execute format('drop policy if exists %I_admin_read on public.%I;', t, t);
    execute format(
      'create policy %I_admin_read on public.%I for select
         using (public.is_admin());', t, t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Reference tables — members read, admins write
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  ref_tables text[] := array[
    'schools','departments','school_departments','professors',
    'professor_affiliations','professor_sources','professor_metrics',
    'papers','professor_papers','lab_members','deadlines','deadline_sources',
    'screening_questions','toefl_practice_sets'
  ];
begin
  foreach t in array ref_tables loop
    execute format('drop policy if exists %I_member_read on public.%I;', t, t);
    execute format(
      'create policy %I_member_read on public.%I for select
         using (public.is_member());', t, t);
    execute format('drop policy if exists %I_admin_write on public.%I;', t, t);
    execute format(
      'create policy %I_admin_write on public.%I for all
         using (public.is_admin()) with check (public.is_admin());', t, t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- audit_logs — admins read; inserts via service role only
-- -----------------------------------------------------------------------------
drop policy if exists audit_admin_read on public.audit_logs;
create policy audit_admin_read on public.audit_logs
  for select using (public.is_admin());
