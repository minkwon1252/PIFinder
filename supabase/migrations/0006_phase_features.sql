-- =============================================================================
-- Phase features migration
--   * Issue 5: nickname for distinguishing PI Finder runs.
--   * Issue 3: per-run candidate preference (1 = primary/blue, 2 = secondary/green).
--   * Issue 4: LLM usage tracking table.
-- Run AFTER 0005. All statements are idempotent.
-- =============================================================================

-- Issue 5 — run nicknames (owner-editable via existing search_runs owner RLS).
alter table public.search_runs add column if not exists nickname text;

-- Issue 3 — candidate preference rank within a run (NULL = unselected).
alter table public.candidate_professors
  add column if not exists preference_rank smallint;
do $$
begin
  alter table public.candidate_professors
    add constraint candidate_professors_preference_rank_chk check (preference_rank in (1, 2));
exception when duplicate_object then null; end $$;

-- Issue 4 — LLM usage log (one row per generation attempt).
create table if not exists public.llm_usage (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  feature        text not null,                 -- e.g. 'story_generation'
  provider       text not null,                 -- e.g. 'anthropic' | 'mock'
  model          text not null,
  input_tokens   integer,
  output_tokens  integer,
  total_tokens   integer,
  estimated_cost numeric(10,5),
  success        boolean not null default true,
  error_type     text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_llm_usage_user_created
  on public.llm_usage (user_id, created_at desc);

-- RLS: a user reads their own usage; admins read all. Inserts are server-side
-- (service role), so no public insert policy is needed.
alter table public.llm_usage enable row level security;

drop policy if exists llm_usage_owner_read on public.llm_usage;
create policy llm_usage_owner_read on public.llm_usage
  for select using (user_id = auth.uid());

drop policy if exists llm_usage_admin_read on public.llm_usage;
create policy llm_usage_admin_read on public.llm_usage
  for select using (public.is_admin());

-- PostgREST grants (CLI migrations run as `postgres`; see 0004_grants.sql).
grant select, insert, update, delete on public.llm_usage
  to anon, authenticated, service_role;
