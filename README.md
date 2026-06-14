# PIFinder

**Find your PI. Build your story. Manage your application.**

A STEM-member-only graduate-school application copilot for SNU engineering students applying to
US programs. STEM = *SNU Tomorrow's Engineering Membership*, an honor society for SNU engineering
students.

- **PI Finder** — finds optimal professors/PIs per student (department list + ultimate match).
- **ENG Trainer** — TOEFL-style writing practice and English typing drills.
- **Secretary** — application deadline tracking from official pages.

Stack: Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Auth, Postgres, Storage, RLS).

---

## Table of contents
1. [Local setup](#1-local-setup)
2. [Supabase setup](#2-supabase-setup)
3. [Environment variables](#3-environment-variables)
4. [Database migration](#4-database-migration)
5. [GitHub push](#5-github-push)
6. [Server deployment](#6-server-deployment)
7. [Updating the deployed app](#7-updating-the-deployed-app)
8. [Security checklist](#8-security-checklist)
9. [Backup checklist](#9-backup-checklist)
10. [Architecture](#10-architecture)

---

## 1. Local setup

Requirements: Node 20+ (tested on Node 24), npm 11, and `psql` (for migrations).

```bash
git clone <your-fork-or-remote> PIFinder
cd PIFinder
npm install
cp .env.example .env.local      # then fill in values (see §3)
npm run dev                     # http://localhost:3000
```

Other commands:

```bash
npm run build && npm run start  # production build + serve
npm run lint                    # eslint
npm run typecheck               # tsc --noEmit
npm run test                    # vitest (unit tests)
```

## 2. Supabase setup

For the MVP we use **managed Supabase**.

1. Create a project at <https://supabase.com>.
2. **Project Settings → API**: copy the Project URL, the `anon` public key, and the
   `service_role` key.
3. **Project Settings → Database → Connection string (URI)**: copy it for migrations.
4. **Authentication → Providers → Email**: enable Email (magic link). Set the Site URL to your
   app URL and add `http://localhost:3000/auth/callback` (and your prod callback) to the
   redirect allow-list.
5. Run the migrations and seed (see §4). Migration `0003_storage.sql` creates the **private**
   `cvs` bucket with owner-only RLS.

> The `service_role` key bypasses RLS. It is used **server-side only** (membership gate, audit
> logging, admin bootstrap) and must never reach the browser.

## 3. Environment variables

Copy `.env.example` → `.env.local`. Variables:

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_NAME` | public | App display name |
| `NEXT_PUBLIC_APP_URL` | public | Base URL (used for magic-link redirects) |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key (RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only secret** | Bypasses RLS; gate/audit/admin only |
| `SUPABASE_DB_URL` | server-only secret | Postgres URI for migrations |
| `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN` | public | Required email domain (`snu.ac.kr`) |
| `BOOTSTRAP_ADMIN_EMAILS` | server-only | Comma-separated emails auto-promoted to admin |
| `LLM_PROVIDER` / `LLM_MODEL` | server-only | Swappable LLM (`mock` \| `anthropic` \| `openai`) |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | server-only secret | LLM keys |
| `OPENALEX_MAILTO`, `SEMANTIC_SCHOLAR_API_KEY` | server-only | Source adapters (Phase 3) |
| `RATE_LIMIT_RUNS_PER_DAY` | server-only | Cap on expensive PI Finder runs/user/day |

**Never commit `.env*` files** (only `.env.example` is tracked).

## 4. Database migration

Migrations live in `supabase/migrations/` and run in order:

- `0001_init.sql` — schema (all tables, enums, triggers, `is_admin()`/`is_member()`).
- `0002_rls.sql` — Row Level Security policies on every table.
- `0003_storage.sql` — private `cvs` storage bucket + object policies.

```bash
# Requires SUPABASE_DB_URL in the environment.
node --env-file=.env.local scripts/db-migrate.mjs
node --env-file=.env.local scripts/db-seed.mjs     # schools, departments, sample data
```

Alternatively run each file with the Supabase SQL editor or `psql "$SUPABASE_DB_URL" -f <file>`.

After migrating, sign in once with a `BOOTSTRAP_ADMIN_EMAILS` address to become admin, then add
members in **/admin/members**.

## 5. GitHub push

```bash
git init                      # if not already a repo
git add .
git commit -m "Initial PIFinder scaffold"
git branch -M main
gh repo create PIFinder --private --source=. --remote=origin   # or create on github.com
git remote add origin git@github.com:<you>/PIFinder.git        # if not using gh
git push -u origin main
```

`.gitignore` excludes `.env*`, keys, and `backups/`. Verify no secrets are staged:
`git status` and `git grep -i "service_role"` should show nothing sensitive.

## 6. Server deployment

Target: `stem@100.124.141.21`, path `/home/stem/apps/PIFinder`. Docker-based.

```bash
# On the club server (one-time):
ssh stem@100.124.141.21
mkdir -p /home/stem/apps/PIFinder
cd /home/stem/apps/PIFinder
git clone git@github.com:<you>/PIFinder.git .
cp .env.example .env.production          # fill in PROD secrets; do NOT commit
# set NEXT_PUBLIC_APP_URL to the public URL and add its /auth/callback in Supabase

# Build + run (binds to 127.0.0.1:3000; front with nginx/caddy for TLS):
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Apply DB migrations from the server (or any machine with psql + SUPABASE_DB_URL):
node --env-file=.env.production scripts/db-migrate.mjs
node --env-file=.env.production scripts/db-seed.mjs
```

A helper script is provided: `scripts/deploy.sh` (run on the server).

## 7. Updating the deployed app

```bash
ssh stem@100.124.141.21
cd /home/stem/apps/PIFinder
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
# if migrations changed:
node --env-file=.env.production scripts/db-migrate.mjs
```

## 8. Security checklist

Before letting real students use the app (and **before uploading real CVs**):

- [ ] `.env*` never committed; `git grep service_role` is clean.
- [ ] Service-role key used only in `src/lib/supabase/admin.ts` (guarded by `server-only`).
- [ ] RLS enabled on **every** table (`0002_rls.sql` applied); verify with the SQL in
      [§ RLS verification](#rls-verification).
- [ ] Owner-only tables enforce `user_id = auth.uid()`.
- [ ] CV bucket `cvs` is **private**; object policies restrict to the owning user folder.
- [ ] Membership gate enforced at login **and** in the auth callback (defense in depth).
- [ ] Only allowlisted `@snu.ac.kr` emails can enter (no auto-admit of all SNU users).
- [ ] Admin actions write to `audit_logs`.
- [ ] Expensive runs are rate-limited (`RATE_LIMIT_RUNS_PER_DAY`).
- [ ] Prod app bound to localhost behind TLS (nginx/caddy); HSTS enabled.
- [ ] Supabase Auth redirect allow-list contains only your real callback URLs.
- [ ] Backups configured and a restore has been test-run (see §9).

<a id="rls-verification"></a>
**RLS verification** — run in the Supabase SQL editor:

```sql
-- Every public table must have RLS enabled (expect zero rows):
select relname from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false;
```

Also sign in as a non-admin test user and confirm you cannot read another user's
`uploaded_documents`, `applications`, or `search_runs`.

## 9. Backup checklist

- [ ] Enable Supabase automated daily backups (Project → Database → Backups), or schedule
      `pg_dump "$SUPABASE_DB_URL" > backups/pifinder-$(date +%F).sql`.
- [ ] Back up the `cvs` storage bucket separately (Supabase Storage export / `supabase storage`).
- [ ] Store backups off-server, encrypted; keep `backups/` out of git (already gitignored).
- [ ] **Test a restore** into a scratch project at least once before trusting it.
- [ ] Document retention (e.g. 30 daily, 12 monthly).

## 10. Architecture

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture summary, coding standards, security
rules, and the professor-evidence policy. High level:

```
src/
  app/                Next.js App Router pages + server actions
  components/          Shared server/client components (nav, badges, shell)
  lib/
    supabase/         client (browser) · server (RLS) · admin (service role) · middleware
    agents/           agent roles + PI Finder pipeline orchestrator
    sources/          professor source adapters (mock, OpenAlex, Semantic Scholar, official)
    scoring/          explainable fit-scoring model
    llm/              swappable LLM provider
    membership.ts     STEM membership gate
    department-expansion.ts, freshness.ts, audit.ts, rate-limit.ts, profile.ts
supabase/
  migrations/         0001 schema · 0002 RLS · 0003 storage
  seed.sql            schools, departments, screening questions, sample professors
tests/                vitest unit tests (gate, scoring, expansion, freshness)
```

**Build phases** (status in `CLAUDE.md`): Phase 1 (auth/onboarding/schema/deploy) and Phase 2
(mock PI Finder pipeline, dossier, shortlist/revive, story builder) are implemented; Phase 3
(real source adapters) has interface-complete stubs + OpenAlex/Semantic Scholar adapters; Phase 4
(Secretary, ENG Trainer) is implemented in MVP form.
