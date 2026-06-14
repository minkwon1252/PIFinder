-- =============================================================================
-- PIFinder — PostgREST role grants
-- Run AFTER 0002_rls.sql.
--
-- WHY THIS EXISTS:
-- CLI migrations (scripts/db-migrate.mjs) connect as the `postgres` role. In a
-- Supabase project the default privileges for the `postgres` role grant the API
-- roles (anon, authenticated, service_role) only {TRUNCATE, REFERENCES,
-- TRIGGER, MAINTAIN} on new tables — deliberately NOT SELECT/INSERT/UPDATE/
-- DELETE. (The full grant is only auto-applied for tables created by
-- `supabase_admin`, e.g. via the dashboard SQL editor.) Without the grants
-- below, every supabase-js call — browser (anon), server (authenticated), and
-- admin (service_role) — fails with "permission denied for table ...".
--
-- SECURITY: RLS is enabled on every table in 0002_rls.sql and remains the
-- row-level gate for anon/authenticated (all policies key on auth.uid() /
-- is_member() / is_admin(), so anon matches no rows). service_role bypasses RLS
-- by design and is used only in server-side code (src/lib/supabase/admin.ts).
-- This mirrors the grants a dashboard-created Supabase schema already has.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete
  on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select
  on all sequences in schema public
  to anon, authenticated, service_role;

grant execute
  on all functions in schema public
  to anon, authenticated, service_role;

-- Future objects created by the `postgres` role inherit the same grants, so
-- later migrations don't reintroduce the permission-denied problem.
alter default privileges in schema public
  grant select, insert, update, delete on tables
  to anon, authenticated, service_role;

alter default privileges in schema public
  grant usage, select on sequences
  to anon, authenticated, service_role;

alter default privileges in schema public
  grant execute on functions
  to anon, authenticated, service_role;
