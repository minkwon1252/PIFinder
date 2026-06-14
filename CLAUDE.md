# CLAUDE.md — PIFinder project instructions

Guidance for Claude Code (and humans) working in this repo.

## Architecture summary

PIFinder is a Next.js (App Router) + TypeScript + Tailwind + Supabase app. It is a STEM-member-
only graduate-school application copilot for SNU engineering students.

- **Auth & membership**: Supabase email magic-link. A user may enter ONLY IF (1) email ends with
  `snu.ac.kr` AND (2) email is on the admin-maintained `member_allowlist`. Enforced in
  `src/lib/membership.ts`, at login (`src/app/login/actions.ts`) and again in the callback
  (`src/app/auth/callback/route.ts`). Roles: `member`, `admin`.
- **Supabase clients**: `lib/supabase/client.ts` (browser, anon), `server.ts` (RLS, anon, cookie-
  bound), `admin.ts` (**service role, server-only, bypasses RLS**), `middleware.ts` (session
  refresh + route guard).
- **Data model**: `supabase/migrations/0001_init.sql`. Every user-owned table has `user_id`.
  RLS in `0002_rls.sql`; private CV bucket in `0003_storage.sql`.
- **Agents**: `lib/agents/roles.ts` defines the 10 roles (Intake, School Mapper, Professor Scout,
  Bibliometric Analyst, Fit Ranker, Screening, Professor-level Reviewer, Story Coach, Secretary,
  ENG Trainer). `lib/agents/pipeline.ts` orchestrates the PI Finder run.
- **Sources**: `lib/sources/*` — adapter interface + Mock (MVP), OpenAlex, Semantic Scholar,
  official-page (stub). Every professor claim must trace to a `professor_sources` record.
- **Scoring**: `lib/scoring/fit.ts` — explainable model; store components, not just totals.
- **LLM**: `lib/llm/provider.ts` — swappable (`mock` default, `anthropic`). Default model id
  `claude-opus-4-8`.

## Commands

```bash
npm run dev         # local dev server
npm run build       # production build (output: standalone)
npm run start       # serve the build
npm run lint        # eslint (next/core-web-vitals)
npm run typecheck   # tsc --noEmit
npm run test        # vitest unit tests
node --env-file=.env.local scripts/db-migrate.mjs
node --env-file=.env.local scripts/db-seed.mjs
```

## Coding standards

- TypeScript strict; `noUncheckedIndexedAccess` is on — guard array/object access.
- Prefer **server components**; use `"use client"` only where interactivity is required.
- Sensitive logic goes in **server actions / route handlers**, never the client.
- Use the `@/` path alias for `src/`.
- Keep components small; match the existing Tailwind utility-class style (`.card`, `.btn-*`).
- Reference / global data: read via the RLS server client; admin writes go through server
  actions that first call `requireAdmin()`.

## Security rules (non-negotiable)

1. **Never** import `lib/supabase/admin.ts` (service role) into a client component. It is marked
   `server-only`; keep it that way.
2. **Never** expose `SUPABASE_SERVICE_ROLE_KEY`, DB URLs, or LLM keys to the browser. Only
   `NEXT_PUBLIC_*` vars may reach the client.
3. **Never** commit `.env*` (except `.env.example`) or any key file.
4. Every new user-owned table MUST: include `user_id`, enable RLS, and add an owner-only policy
   (`user_id = auth.uid()`). Add it to the `owner_tables` array in `0002_rls.sql`.
5. CV / document files stay in the **private** `cvs` bucket under a `<uid>/` folder prefix.
6. All admin mutations must write an `audit_logs` entry (use `lib/audit.ts`).
7. Expensive AI/search actions must pass `checkRunRateLimit` (or an equivalent) first.
8. Do not auto-admit all `snu.ac.kr` users — the allowlist is mandatory.

## Professor evidence rules

- Every professor recommendation must include evidence and a source record. Do not hallucinate
  professor details, metrics, papers, or lab members.
- Clearly separate **verified fact**, **inferred fit**, **user-provided info**, and
  **missing/uncertain** (`components/EvidenceTag.tsx`, enum `evidence_kind`).
- If data is missing, say so — never fabricate to fill a gap.
- Generative steps (Story Coach, Reviewer) must not invent experience, publications, awards, or
  personal connections. Ground SOP angles only in the student's real CV/projects.
- Sample/seed professor data is prefixed `[SAMPLE]` and carries low confidence; never present it
  as real.

## Deployment rules

- Managed Supabase for MVP; a migration path to self-hosted Supabase/Postgres is intended (keep
  SQL provider-neutral where practical).
- Production runs via Docker (`docker-compose.prod.yml`), bound to `127.0.0.1:3000` behind TLS.
- Run DB migrations on deploy when `supabase/migrations` changed.
- Server path: `/home/stem/apps/PIFinder` on `stem@100.124.141.21`. Secrets live in
  `.env.production` on the server only.

## Build phase status

- **Phase 1** (auth, onboarding/profile, schema+RLS, seed, dashboard, deploy docs): ✅ done.
- **Phase 2** (mock PI Finder pipeline, screening UI, dossier, shortlist + revive, story builder):
  ✅ done (MVP).
- **Phase 3** (real source adapters): OpenAlex + Semantic Scholar implemented; official-page
  adapter is an interface-complete stub; freshness/confidence wired.
- **Phase 4** (Secretary deadlines, ENG Trainer writing+typing): ✅ MVP.
- **Phase 5** (testing, security review, RLS verification, deploy scripts): partial — unit tests +
  checklists present; full RLS integration tests are a TODO.
