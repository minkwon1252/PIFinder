# PIFinder

**Find your PI. Build your story. Manage your application.**

PIFinder is a graduate-school application copilot for **SNU STEM members** applying to US programs.
STEM = *SNU Tomorrow's Edge Membership*, an honor society for SNU engineering students. The app
helps you find the right professors/PIs, understand why they fit, build an honest application
story grounded in your real CV, train your English, and track deadlines.

- 🌐 **Live (beta):** <https://pi-finder-ten.vercel.app>
- 🔒 **Members only:** you can sign in **only if** your email is `@snu.ac.kr` **and** an admin has
  added you to the member allowlist. (This is by design — see [Who can use it](#who-can-use-it).)

Stack: Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Auth · Postgres · Storage · RLS),
hosted on **Vercel** with a managed **Supabase** backend.

---

# Part A — User guide

For STEM members using the app. No setup needed — just open the site.

## Who can use it

The membership gate requires **both**:
1. Your email ends with `@snu.ac.kr`, **and**
2. Your email is on the admin-maintained allowlist.

If you get *"This email is not on the STEM member allowlist"*, ask an admin to add you. Being an
SNU student alone is **not** enough — the allowlist is mandatory.

## Signing in

PIFinder uses **passwordless magic links** (no password to remember):

1. Go to <https://pi-finder-ten.vercel.app/login>.
2. Enter your `@snu.ac.kr` email and submit.
3. Check your inbox for a sign-in link and click it (check spam the first time, then mark
   "not spam"). You'll be brought into the app.
4. First-time users land on **onboarding** to build a research profile.

## What you can do

### 1. Build your Research Profile (onboarding)
Set your major(s), target degree (MS / PhD / MS-PhD), research-method preference, 2–3 interest
keywords, preferred application area, an optional project summary, and your **target schools**
(tagged Reach / Target / Foundation). You can also upload your **CV (PDF)** — it's stored in a
**private** bucket only you and admins can access. This profile is reused by every PI Finder run
and is editable anytime from **Profile**.

### 2. Dashboard
Your home base: jump into PI Finder, view saved professors, and track application requirements.

### 3. PI Finder — the core feature
Runs a multi-step pipeline that, for your targets, produces a **ranked list of professors** with
an **explainable fit score** and **evidence for every claim**:

1. Start a run from **PI Finder**.
2. Answer a short **screening** questionnaire that sharpens the match to your interests.
3. Review results: each candidate shows a fit score broken into components (not just a single
   number), plus tier (Reach / Target / Foundation) and the sources behind every professor detail.
4. Open a professor's **dossier** for the full picture: affiliations, bibliometric signals,
   representative papers, and lab info — each tagged as **verified fact**, **inferred fit**,
   **your info**, or **missing/uncertain** so you always know what's evidence vs. inference.

> **Honesty guarantee:** PIFinder never invents professor details, metrics, or papers. Sample/seed
> data is labeled `[SAMPLE]` and shown as low-confidence — never treat it as real.

### 4. Shortlist
Save professors you like, **eliminate** ones you don't, and **revive** eliminated ones later if you
change your mind. Keeps your decision history so a run doesn't lose your judgments.

### 5. Story Builder
For a saved professor, get help shaping your **statement-of-purpose angle** — grounded **only** in
your real CV and projects. It will not fabricate experience, publications, awards, or connections;
it helps you frame what you actually have.

### 6. ENG Trainer
- **Writing:** TOEFL-style writing practice.
- **Typing:** English typing drills that measure WPM and accuracy on academic text.

### 7. Secretary — deadlines
Track application requirements and deadlines for your target programs.

### 8. Profile
Edit your research profile and re-upload your CV anytime.

### Admins
Admins get an **/admin** area to manage the member allowlist, professors, schools, and deadlines.
Admin actions are audited.

## Giving beta feedback

You're testing an early version — please report anything confusing, broken, or wrong (especially
any professor info that looks fabricated or mislabeled). Tell us what you expected vs. what happened.

---

# Part B — Developer guide

## How it's built & hosted

| Layer | What we use |
|---|---|
| Frontend + server | **Next.js 15** (App Router, React 19, server components + server actions), TypeScript, Tailwind |
| Hosting | **Vercel** (managed) — auto-deploys from the GitHub `main` branch. Production URL: `https://pi-finder-ten.vercel.app` |
| Backend | **Supabase (managed cloud)** — Auth (email magic link), Postgres, Storage, Row Level Security |
| Auth email | Custom **SMTP via Gmail** (Supabase → Auth → SMTP), to get past the built-in email rate limit |
| LLM | Swappable provider (`mock` default; `anthropic` for real). Default model `claude-opus-4-8` |
| Professor data | Source adapters: Mock (MVP), OpenAlex, Semantic Scholar, official-page (stub) |

> **Note on the club server.** There is also a self-host path targeting `stem@100.124.141.21`
> (`/home/stem/apps/PIFinder`) via Docker — but that host is a **Tailscale** address (`100.x`,
> not publicly routable), so it's intended for private/internal access, not the public beta. The
> public beta runs on Vercel. See [Deployment](#deployment) for both paths.

## Architecture

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture, coding standards, security rules, and the
professor-evidence policy. High level:

```
src/
  app/                 Next.js App Router pages + server actions
    login, onboarding, dashboard, profile
    pi-finder/…        run → screening → results
    professors/[id]    professor dossier (evidence-tagged)
    shortlist, story-builder, secretary, eng-trainer/{writing,typing}
    admin/…            members · professors · schools · deadlines
    auth/callback      magic-link callback (re-checks the membership gate)
  components/          AppShell, AppNav, EvidenceTag, TierBadge
  lib/
    supabase/          client (browser) · server (RLS) · admin (service role) · middleware
    agents/            10 agent roles + PI Finder pipeline orchestrator
    sources/           professor source adapters (mock, OpenAlex, Semantic Scholar, official)
    scoring/           explainable fit-scoring model (stores components, not just totals)
    llm/               swappable LLM provider
    membership.ts      STEM membership gate (domain + allowlist)
    department-expansion.ts, freshness.ts, audit.ts, rate-limit.ts, profile.ts, env.ts
supabase/
  migrations/          0001 schema · 0002 RLS · 0003 storage · 0004 grants
  seed.sql             schools, departments, screening questions, sample professors
scripts/
  db-migrate.mjs       apply migrations (pg driver — no psql needed)
  db-seed.mjs          apply seed.sql (reference data + [SAMPLE] professors)
  seed-professors-openalex.mjs  seed REAL professors from OpenAlex (provenance-backed)
  allowlist-add.mjs    bulk-add members to the allowlist
  deploy.sh            self-host (Docker) deploy helper
tests/                 vitest unit tests (gate, scoring, expansion, freshness)
```

**The 10 agent roles** (`lib/agents/roles.ts`): Intake, School Mapper, Professor Scout,
Bibliometric Analyst, Fit Ranker, Screening, Professor-level Reviewer, Story Coach, Secretary,
ENG Trainer. The PI Finder run is orchestrated in `lib/agents/pipeline.ts`. Every professor claim
must trace to a `professor_sources` record.

## Local setup

Requirements: **Node 20+** (tested on Node 24) and npm. No `psql` needed — migrations run through
the bundled `pg` driver.

```bash
git clone git@github.com:minkwon1252/PIFinder.git
cd PIFinder
npm install
cp .env.example .env.local      # fill in values (see Environment variables)
npm run dev                     # http://localhost:3000
```

Other commands:

```bash
npm run build && npm run start  # production build + serve
npm run lint                    # eslint
npm run typecheck               # tsc --noEmit
npm run test                    # vitest unit tests
```

## Environment variables

Copy `.env.example` → `.env.local` (local) / set them in Vercel (production).

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_NAME` | public | App display name |
| `NEXT_PUBLIC_APP_URL` | public | Base URL — drives magic-link redirects. Must match the deployed URL (`https://pi-finder-ten.vercel.app` in prod, `http://localhost:3000` locally) |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key (RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only secret** | Bypasses RLS; gate/audit/admin only |
| `SUPABASE_DB_URL` | server-only secret | Postgres URI — **only** for running migrations/seed/allowlist scripts. **Not** needed by the app at runtime (don't set it on Vercel). |
| `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN` | public | Required email domain (`snu.ac.kr`) |
| `BOOTSTRAP_ADMIN_EMAILS` | server-only | Comma-separated emails auto-promoted to admin on first login |
| `LLM_PROVIDER` | server-only | Default LLM provider: `mock` \| `anthropic` \| `openai` \| `gemini` |
| `ANTHROPIC_API_KEY` / `LLM_MODEL` | server-only secret | Claude key + model. Used by `POST /api/story/generate`; never sent to the browser |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | server-only secret | ChatGPT (OpenAI) key + model (default `gpt-4o-mini`) |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | server-only secret | Gemini (Google) key + model (default `gemini-2.0-flash`) |
| `MONTHLY_STORY_GENERATION_LIMIT` | server-only | Per-user monthly cap on LLM story generations (`0` = unlimited) |
| `OPENALEX_MAILTO`, `SEMANTIC_SCHOLAR_API_KEY`, `CROSSREF_MAILTO` | server-only | Source adapters (Phase 3) |
| `RATE_LIMIT_RUNS_PER_DAY` | server-only | Cap on expensive PI Finder runs/user/day |

**Never commit `.env*` files** (only `.env.example` is tracked). The `service_role` key bypasses RLS
and is used **server-side only** (membership gate, audit logging, admin bootstrap) — never in the
browser.

## Supabase setup

1. Create a project at <https://supabase.com>.
2. **Project Settings → API:** copy the Project URL, `anon` key, and `service_role` key.
3. **Project Settings → Database → Connection string (URI):** copy it for migrations
   (`SUPABASE_DB_URL`). Use the direct / session pooler URI (port 5432).
4. **Authentication → URL Configuration:** set **Site URL** and add redirect URLs for both
   `http://localhost:3000/**` (dev) and your prod URL `https://pi-finder-ten.vercel.app/**`.
5. **Authentication → SMTP Settings:** configure custom SMTP (we use Gmail SMTP with an App
   Password) so magic-link emails aren't throttled by Supabase's built-in sender. Then raise the
   email rate limit under **Authentication → Rate Limits**.
6. Run the migrations + seed (below). `0003_storage.sql` creates the **private** `cvs` bucket.

## Database migrations

Migrations live in `supabase/migrations/` and run in order via the `pg` driver (no `psql` required):

- `0001_init.sql` — schema (tables, enums, triggers, `is_admin()` / `is_member()`).
- `0002_rls.sql` — Row Level Security policies on every table.
- `0003_storage.sql` — private `cvs` storage bucket + object policies.
- `0004_grants.sql` — grants the PostgREST roles (anon/authenticated/service_role) DML on the
  schema. **Required** because CLI migrations connect as the `postgres` role, whose Supabase
  default privileges grant the API roles only TRUNCATE/REFERENCES/TRIGGER — not SELECT/INSERT/
  UPDATE/DELETE. Without it, every API call returns "permission denied". RLS still gates rows.

```bash
node --env-file=.env.local scripts/db-migrate.mjs    # apply all migrations
node --env-file=.env.local scripts/db-seed.mjs       # schools, departments, sample data
```

The scripts read `SUPABASE_DB_URL`. `npm run db:migrate` / `npm run db:seed` do the same (they load
`.env.local` automatically).

## Members & admin

- **Bootstrap admin:** sign in once with a `BOOTSTRAP_ADMIN_EMAILS` address; you're promoted to
  admin and implicitly allowlisted on first login.
- **Add beta testers** to the allowlist (they each need an `@snu.ac.kr` email too):

  ```bash
  # inline:
  node --env-file=.env.local scripts/allowlist-add.mjs alice@snu.ac.kr bob@snu.ac.kr
  # or from a file (one email per line):
  node --env-file=.env.local scripts/allowlist-add.mjs --file members.txt
  ```

  Admins can also manage the allowlist from **/admin/members**.

## Real professor data (OpenAlex)

`scripts/seed-professors-openalex.mjs` populates the `professors` / `professor_affiliations` /
`professor_metrics` / `professor_sources` tables with **real, source-backed** faculty for the
7 seeded top schools (MIT, Stanford, UC Berkeley, Northwestern, Caltech, Princeton, Harvard) across
all 14 departments. It queries OpenAlex (no API key) for the most active recent (2020+) authors per
institution × department topic-field, keeps only those whose *current* institution still matches
(drops people who moved), and stores real metrics + an `openalex` source record per professor.
Homepage/lab URLs are left null on purpose — OpenAlex doesn't provide them and we don't invent them
(the official-page adapter milestone fills those). Re-runnable/idempotent.

```bash
node --env-file=.env.local scripts/seed-professors-openalex.mjs
# scope a single school / fewer per dept while testing:
ONLY_SCHOOL=MIT N_PER=4 node --env-file=.env.local scripts/seed-professors-openalex.mjs
```

> Department attribution is inferred from OpenAlex topic fields (approximate), not official faculty
> rosters — that authoritative mapping is the official-page **Phase 3 milestone**. Until then,
> treat the department tag as a strong hint, not ground truth.

## Deployment

### Primary: Vercel (current public beta)

1. Push to GitHub (`git push origin main`).
2. Import the repo at <https://vercel.com> → it auto-detects Next.js.
3. Set the environment variables above in Vercel (Production). **Skip `SUPABASE_DB_URL`** — the app
   doesn't use it; migrations are run locally.
4. Deploy. Set `NEXT_PUBLIC_APP_URL` to the resulting stable URL
   (`https://pi-finder-ten.vercel.app`) and redeploy (it's inlined at build time).
5. Update Supabase Site URL + redirect URLs to that URL (see Supabase setup).
6. Migrations are **not** run by Vercel — apply them locally against the shared Supabase project
   whenever `supabase/migrations/` changes.

**Custom domain (later):** to use e.g. `stem-pifinder.com`, register it (easiest via Vercel →
Settings → Domains, which auto-configures DNS + HTTPS), then point `NEXT_PUBLIC_APP_URL` and the
Supabase Site URL at it.

### Alternative: self-host on the club server (Docker)

For internal/Tailscale access on `stem@100.124.141.21`:

```bash
ssh stem@100.124.141.21
mkdir -p /home/stem/apps/PIFinder && cd /home/stem/apps/PIFinder
git clone git@github.com:minkwon1252/PIFinder.git .
cp .env.example .env.production          # fill in PROD secrets; do NOT commit
# Build + run (binds to 127.0.0.1:3000; front with nginx/caddy for TLS, or expose via a tunnel):
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
node --env-file=.env.production scripts/db-migrate.mjs
```

Updating: `git pull` then re-run the `docker compose … up -d --build`. Helper: `scripts/deploy.sh`.

## Security checklist

Before real students use the app (and **before real CVs are uploaded**):

- [ ] `.env*` never committed; `git grep service_role` shows nothing sensitive.
- [ ] Service-role key used only in `src/lib/supabase/admin.ts` (guarded by `server-only`).
- [ ] RLS enabled on **every** table (`0002_rls.sql`); verify with the SQL below.
- [ ] API-role grants applied (`0004_grants.sql`) — RLS, not missing grants, is what gates access.
- [ ] Owner-only tables enforce `user_id = auth.uid()`.
- [ ] CV bucket `cvs` is **private**; object policies restrict to the owning user's folder.
- [ ] Membership gate enforced at login **and** in the auth callback (defense in depth).
- [ ] Only allowlisted `@snu.ac.kr` emails can enter (no auto-admit of all SNU users).
- [ ] Admin actions write to `audit_logs`.
- [ ] Expensive runs are rate-limited (`RATE_LIMIT_RUNS_PER_DAY`).
- [ ] Supabase Auth redirect allow-list contains only your real callback URLs.
- [ ] Backups configured and a restore has been test-run.

**RLS verification** — run in the Supabase SQL editor (expect zero rows):

```sql
select relname from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false;
```

Also sign in as a non-admin test user and confirm you cannot read another user's
`uploaded_documents`, `applications`, or `search_runs`.

## Backups

- [ ] Enable Supabase automated daily backups (Project → Database → Backups), or schedule
      `pg_dump "$SUPABASE_DB_URL" > backups/pifinder-$(date +%F).sql`.
- [ ] Back up the `cvs` storage bucket separately.
- [ ] Store backups off-server, encrypted; keep `backups/` out of git (gitignored).
- [ ] **Test a restore** into a scratch project at least once.

## Build phases

Status tracked in `CLAUDE.md`. Phase 1 (auth/onboarding/schema/deploy) and Phase 2 (mock PI Finder
pipeline, dossier, shortlist/revive, story builder) are implemented; Phase 3 (real source adapters)
has OpenAlex + Semantic Scholar adapters and an interface-complete official-page stub; Phase 4
(Secretary, ENG Trainer) is implemented in MVP form; Phase 5 (testing/security) is partial.
