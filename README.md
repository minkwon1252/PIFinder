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
Produces a **ranked list of professors** for your targets with an **explainable fit score** and
**evidence for every claim**. Three modes:

- **Mode A · Department list** — for each target school + relevant department, the top three
  professors.
- **Mode B · Ultimate match** — the single strongest match per school, with a full "how you connect"
  fit breakdown.
- **Mode C · Manual database search** — search the professor database yourself (name, university,
  department, keywords) with no automated matching or AI; open a profile or save to your shortlist.

Then:
1. Start a run (a fun-facts overlay keeps you company while it computes — it can take up to a minute).
2. **Interactive screening:** for each question, mark your top preference (turns **blue**) and
   optionally a second (**green**). Each pass re-ranks your candidates and shows the iteration number;
   the results page lists exactly what changed.
3. Review results: each candidate shows the fit score broken into components, tier
   (Reach / Target / Foundation), and the sources behind every detail. Your own major department is
   preferred in the ranking, but neighbouring departments still appear.
4. Open a professor's **dossier**: affiliations, bibliometrics, recent papers, and lab info — each
   tagged as **verified fact**, **inferred fit**, **your info**, or **missing/uncertain**.

> **Honesty guarantee:** PIFinder never invents professor details, metrics, or papers. Sample/seed
> data is labeled `[SAMPLE]` and shown as low-confidence — never treat it as real.

### 4. Shortlist
Save professors you like, **eliminate** ones you don't, and **revive** eliminated ones later if you
change your mind. Keeps your decision history so a run doesn't lose your judgments.

### 5. Story Builder
For a saved professor, generate an honest application story (via a real LLM — **Claude, ChatGPT, or
Gemini**, whichever you pick from the Model dropdown). It connects **your dream/background to the
lab's research aims** and **how you could contribute**, grounded **only** in your real profile, CV,
and projects — it never fabricates experience, publications, awards, or connections. Your monthly
usage is shown and capped. Upload your **CV** and an optional **"story" file** (statement, portfolio)
in your profile to make the fit richer.

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

## Matching algorithm

PI Finder ranks professors with a **transparent, weighted, additive fit score** — no LLM is used for
matching (the LLM is only for Story Builder / ENG Trainer). Pipeline: `lib/agents/pipeline.ts`;
scoring: `lib/scoring/fit.ts`; department scope: `lib/department-expansion.ts`.

**1. Candidate set (which professors are considered).** For each target school, `expandDepartments`
returns the departments to search based on your **major + its adjacent departments + keyword-driven
additions + tier breadth** (Foundation = focused, Target = +closely-related, Reach = broad). So you
always see beyond your own major; your major is then **preferred in the ranking** (not the only
option). Professors affiliated with those departments at that school become candidates.

**2. Per-candidate fit score (`scoreFit`), 0–100.** Eight components, each 0–1, weighted:

| Component | Weight | How it's computed |
|---|---|---|
| `keyword_fit` | 0.26 | Jaccard overlap of your interest keywords vs. the professor's research themes |
| `project_overlap` | 0.18 | Jaccard overlap of keywords from your project summary vs. the themes |
| `method_fit` | 0.14 | Your preferred method (experimental/computational/…) vs. the lab's style |
| `application_domain_fit` | 0.14 | Whether your application area appears in the lab's themes |
| `publication_recency` | 0.10 | How recently the lab has published (from ingested papers) |
| `dept_school_match` | 0.08 | 1 if the professor is in **your major department**, else 0 |
| `lab_activity` | 0.05 | Normalized recent works count (proxy for an active lab) |
| `mentorship_proxy` | 0.05 | Placeholder proxy for mentorship accessibility |

The weighted sum is then reduced by a **risk penalty** (up to 0.2) that grows as the professor's
source data gets less complete/stale — so thinly-evidenced matches don't rank above well-evidenced
ones. Every component + a human-readable explanation is stored in `candidate_scores`, which powers
the "How you connect" breakdown in the UI.

**3. Refinement (interactive screening).** Each screening question lets you mark up to two ranked
preferences; `answerScreening` boosts the `total_score` of candidates whose themes/identity match
(Preference 1 weighted more than Preference 2) and records what changed. The results page re-sorts by
the updated score — so refining visibly re-ranks. Mode A keeps the top 3 per school/department; Mode
B keeps the single top match per school.

**What feeds the match from _you_:** majors, target degree, research-method preference, interest
keywords, application area, project summary (keyword-extracted), and target schools/tiers — all from
your profile. CV and the optional "story" file are stored privately; feeding their *text* into the
LLM for richer story generation is a planned enhancement (currently the structured profile +
project summary drive it).

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
