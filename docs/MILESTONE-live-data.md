# Milestone: Live professor data (Phase 3 completion)

**Goal.** Move PI Finder from reading a pre-seeded snapshot to producing recommendations from
**live, multi-source, provenance-tracked** professor data — without ever fabricating or mislabeling
a professor detail (the project's cardinal evidence rule).

**Status going in.** Real professor data exists in the DB (seeded from OpenAlex via
`scripts/seed-professors-openalex.mjs`: ~359 faculty, 7 schools × 14 departments, with metrics +
source records). But:
- `runPiFinder` reads the `professors` tables **directly**; it never calls the source adapters
  (`getSourceAdapters()` is currently dead code).
- The `official-page` adapter (the authoritative source for *who is faculty in a department*) is a
  stub returning `[]`. Department attribution today is **inferred** from OpenAlex topic fields.
- OpenAlex/Semantic Scholar adapters do global author keyword search, not school-scoped faculty.

This milestone closes those gaps.

---

## Guiding constraints (non-negotiable)

1. **No fabrication.** Every professor field shown must trace to a `professor_sources` record
   (`source_type` + `url` + `retrieved_at` + `confidence`). Missing data stays missing.
2. **Separate fact from inference.** Verified affiliation (official roster) vs. inferred department
   (topic-derived) vs. user-provided vs. uncertain — surfaced via `EvidenceTag` / `evidence_kind`.
3. **Respect sources.** OpenAlex/S2 polite-pool etiquette; official-page fetches honor `robots.txt`,
   rate-limit, and cache. No Google Scholar scraping.
4. **Cost & abuse control.** Live runs gated by `checkRunRateLimit`; external calls cached.
5. **RLS unchanged.** Reference data written via admin/service-role ingestion only.

---

## Architecture: ingest-then-read (recommended)

Keep `runPiFinder` reading from the DB (fast, deterministic, already works), and introduce an
**ingestion layer** that keeps the DB fresh from live sources. This avoids slow/flaky external
calls inside an interactive run and gives natural caching + provenance.

```
 Sources (adapters)            Ingestion (new)             Read path (exists)
 ─────────────────             ───────────────             ─────────────────
 official-page  ─┐
 openalex        ├─► resolve+merge+dedupe ─► upsert professors/         ─► runPiFinder
 semantic-schol ─┘   (provenance, freshness)   affiliations/metrics/        (fit scoring,
 crossref/orcid                                sources/papers               screening, dossier)
```

Alternative (live-in-run) is possible later for a "refresh this professor now" button, but
ingest-then-read is the backbone.

---

## Phased plan

### Phase 3a — Official-page faculty rosters (the hard, highest-value part)
Make department membership **authoritative** instead of inferred.

- Implement `OfficialPageAdapter.search(query)`:
  - Resolve the department's `school_departments.faculty_url` (already seeded for some; extend
    coverage for the 7 schools × 14 depts).
  - Fetch with a real User-Agent, **check `robots.txt`**, timeout + retry, and **cache** (e.g. 7-day
    TTL keyed by URL).
  - Parse the faculty roster → `{ fullName, title, homepageUrl, labName?, labUrl? }`. Rosters vary
    per school, so support a small set of parsing strategies (structured HTML / JSON-LD / per-school
    config) and degrade gracefully (return what's parseable, mark the rest missing).
  - Emit a `department_page` source per professor (`confidence` ~0.9 — authoritative for affiliation).
- Output feeds ingestion: this becomes the **spine** (who is really faculty + their homepage/lab),
  which OpenAlex/S2 then enrich with metrics.

**Acceptance:** for a seeded department, faculty list matches the official page; each row has a
`department_page` source; homepage/lab URLs are real (no nulls invented).

### Phase 3b — Identity resolution & enrichment
Tie roster names to OpenAlex/S2 author records to attach real metrics/papers.

- Add `enrich()` to OpenAlex/S2 adapters: given a `{fullName, institution}`, find the best-matching
  author (disambiguate by institution + ORCID when available; keep a confidence; **drop ambiguous
  matches** rather than guess).
- Pull metrics (h-index, citations, works), recent + influential papers (`papers` /
  `professor_papers`), ORCID. Each with its own source record.
- Store match confidence; if no confident match, professor still exists from the roster with metrics
  marked missing (not zero).

**Acceptance:** ≥X% of roster faculty get a confident OpenAlex/ORCID match; no mismatched-author
metrics (spot-check); unmatched faculty clearly show "metrics: missing".

### Phase 3c — Merge, dedupe & freshness
- **Dedupe** across sources by ORCID → OpenAlex id → (normalized name + institution). One professor,
  many sources/affiliations.
- **Merge policy:** affiliation/title from official page; metrics/papers from OpenAlex/S2; conflicts
  resolved by source `confidence` + recency, and recorded.
- **Freshness:** reuse `lib/freshness.ts` — store `retrieved_at`, compute staleness, drive the
  scoring `dataCompleteness`/risk penalty and a "last verified" UI badge. Re-ingest stale records.

**Acceptance:** re-running ingestion is idempotent; a professor appearing in multiple sources is one
row with multiple `professor_sources`; stale data is flagged.

### Phase 3d — Wire the read path & UI to provenance
- Switch the pipeline's department match to prefer **verified** (`department_page`) affiliations;
  inferred (topic-derived) affiliations are clearly downranked/labeled.
- Dossier (`professors/[id]`) and candidate cards render `EvidenceTag` per field (verified / inferred
  / user / missing) and show source links + "retrieved_at".
- Fit scoring already stores components — feed real `labActivity`, `publication_recency`, etc. from
  ingested metrics/papers.

**Acceptance:** every professor detail in the UI links to a source; inferred vs verified is visually
distinct; no field renders without provenance.

### Phase 3e — Orchestration, cost, ops
- **Ingestion job:** a script/route (`scripts/ingest.mjs` or an admin-triggered route) to run per
  school×dept, with concurrency limits + caching. Schedulable (cron) for periodic refresh.
- **Rate limiting:** gate any user-facing live refresh with `checkRunRateLimit`; cache external
  responses; backoff on 429.
- **Observability:** ingestion run summary (counts, failures per source/department) to `audit_logs`.
- **Tests:** adapter parsers against saved HTML fixtures; identity-resolution disambiguation cases;
  dedupe/merge; an end-to-end ingest→run on one department.

**Acceptance:** one command ingests a department within rate limits; failures are logged not fatal;
tests cover parsing + resolution + merge.

---

## Risks & decisions

| Risk | Mitigation |
|---|---|
| Per-school roster HTML varies wildly | Start with the 7 seeded schools; per-school parser config; graceful partial parse |
| Author misattribution (wrong person's metrics) | Require institution/ORCID-backed match; drop ambiguous; store match confidence |
| `robots.txt` / ToS for official pages | Honor robots, cache aggressively, low request rate, identify UA |
| External API limits/outages | Cache + backoff; ingestion is offline/async, never blocks a user run |
| Inferred-vs-verified confusion for users | Hard visual separation via EvidenceTag; downrank inferred affiliations |

## Suggested order of work
1. **3a official-page adapter** for 2–3 schools (proves the spine) →
2. **3b enrichment + 3c dedupe/freshness** →
3. **3d UI/provenance wiring** →
4. **3e orchestration/tests**, then scale 3a to all 7 schools × 14 depts.

## Progress log

### 3b — enrich roster-only faculty (2026-06-15)
- **`scripts/enrich-professors.mjs`** — matches professors that have a verified official-page
  affiliation but no OpenAlex record to an OpenAlex author, by **name + institution**, and attaches
  real metrics (h-index, citations, works), ORCID, topics, and an `openalex` source carrying the
  match confidence. Idempotent (only `openalex_id IS NULL`).
- **Conservative matching (no misattribution):** query authors filtered to the professor's
  institution + name; among same-name candidates pick the **most productive** (rescues e.g. the real
  "Robert S. Langer" h-264 / "Andrew W. Lo" over sparse homonyms); require works ≥ 3 (drops trivial
  wrong matches); exact full-name → confidence 0.85, first+last → 0.70; no confident match → metrics
  stay **missing**, never zero-filled. Strips trailing credentials (", MD, FACS") before matching.
- `getJson` has a 15s timeout (a stalled connection previously hung the whole run).
- **Result:** 293 of 649 roster-only faculty enriched (45% confident match) → **688 / 1044
  professors now have real metrics** (was 395). 356 remain intentionally missing (no confident
  match — never zero-filled). Zero anomalies (works<3 or null h). Spot-checks correct (Langer h-264,
  Susskind h-79, Tuller h-76); the ambiguity guard left "Li Wang" missing rather than mis-matched.
- TODO (3b cont.): pull recent/influential **papers** into `papers`/`professor_papers` (drives
  `publication_recency` in scoring, which still uses a default until papers land); optionally a
  Semantic Scholar / ORCID second pass for faculty OpenAlex misses.

### 3a — official-page adapter (2026-06-14)
- **Adapter implemented** (`src/lib/sources/official-page.ts`) — no longer a stub. Robots-aware
  descriptive UA, 25s timeout, week-long cache (Next runtime), graceful `[]` on
  failure/unregistered pages (never invents rosters). Combined parser registry; ingestion via
  `scripts/ingest-official.mjs` (HTML + paginated JSON sources); fixture-tested
  (`tests/official-page.test.ts`, 8 cases).
- **MIT ✅** — **235 verified faculty**:
  - EECS (`mit-eecs` HTML parser): 180 faculty, routed CS/EE by the page's area tag.
  - DMSE (`mit-teaser` HTML parser): 56 faculty.
- **Stanford ✅ (no Playwright needed!)** — **160 verified faculty**. Key find: Stanford
  School-of-Engineering department sites expose a **Drupal JSON:API** at
  `https://<dept>.stanford.edu/jsonapi/node/stanford_person`. The `stanford` parser reads it as
  structured JSON (name, full title, Stanford Profiles homepage, email, research interests) and
  keeps only professorial faculty (drops emeritus/lecturer/visiting). Ingested: MSE, ChemE,
  AeroAstro (aa), BioEngineering. Pagination followed in the ingestion script.
- All carry a verified `department_page` source (confidence 0.90) with real homepage URLs; matched
  faculty upgrade their existing OpenAlex record, unmatched are inserted from the authoritative
  roster.
- **Fan-out done (2026-06-14):** **325 verified MIT + 254 verified Stanford faculty.**
  - MIT parsers: `mit-eecs` (EECS→CS/EE), `mit-teaser` (DMSE), `mit-cheme` (ChemE), `mit-cee` (CEE).
  - Stanford JSON:API depts: MSE, ChemE, AeroAstro, BioE, ME, CEE, MS&E→ISE.
- **Sciences + more departments (2026-06-15):**
  - Added a **Biology (BIO)** department; OpenAlex seed now maps it (field 13) → real biology faculty
    across all 7 schools. Stanford Biology roster also ingested via official page (hb-card).
  - Stanford **EE** (`orglist` HTML — only ~10 in static HTML, rest JS-rendered; OpenAlex covers the
    rest), Stanford **Physics** + **Biology** (`hb-card` HTML) now ingested.
  - **Berkeley**: covered via OpenAlex (65 profs). Berkeley dept sites are bespoke with no JSON:API,
    so official-page rosters are a later per-site task.
- **Coverage now:** 1044 professors total (669 with homepage). By verified-via-official-page:
  MSE/CS/ChemE/EE/CEE/BME/PHYS/BIO/ME/AeroE/ISE are strong; **CHEM, MATH, NucE, AP** still rely on
  OpenAlex only.
- **Still TODO in 3a:**
  - MIT MechE (`meche` — JS-rendered), AeroAstro, and MIT science depts (physics/chem/math/bio at
    their own URLs) — bespoke parsers.
  - Stanford **Chemistry** + **Mathematics** (different H&S theme, not `hb-card`) and **CS** (JS/404).
  - Berkeley official rosters (bespoke per-site).
  - Minor: strip credential suffixes (", MD, FACS") from some Stanford names.

## Out of scope (later)
- Schools beyond the 7 seeded; non-US programs.
- Lab-member extraction; advisor-network graph.
- LLM-assisted parsing/summarization (needs `LLM_PROVIDER=anthropic` + key — currently `mock`).
