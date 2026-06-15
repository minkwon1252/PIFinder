#!/usr/bin/env node
/**
 * Milestone 3b (cont.) — pull recent papers from OpenAlex for every professor
 * that has an openalex_id, into public.papers + public.professor_papers.
 *
 * One call per professor (works sorted by publication_year desc). We store the
 * most recent works, flag the most-cited of them is_influential, and the
 * pipeline derives latestPublicationYear from these (drives publication_recency
 * in fit scoring). Real data only — nothing invented.
 *
 * Idempotent: professors that already have professor_papers rows are skipped.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-papers-openalex.mjs
 *   LIMIT=20 CONCURRENCY=6 node --env-file=.env.local scripts/seed-papers-openalex.mjs
 */
import pg from "pg";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) { console.error("ERROR: SUPABASE_DB_URL is not set."); process.exit(1); }
const MAILTO = process.env.OPENALEX_MAILTO || "minkwon@snu.ac.kr";
const BASE = "https://api.openalex.org";
const PER = Number(process.env.PER ?? 8);          // papers kept per professor
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
// OpenAlex polite pool ~10 req/s; keep concurrency low to avoid 429s.
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 3);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shortId = (u) => (u ? String(u).split("/").pop() : null);

async function getJson(url) {
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
      if (res.status === 429) { await sleep(1000 * 2 ** i); continue; } // exp backoff on rate limit
      if (!res.ok) return null;
      return await res.json();
    } catch { await sleep(500 * (i + 1)); }
  }
  return null;
}

/** Map an OpenAlex work → our paper shape. */
function toPaper(w) {
  const loc = w.primary_location ?? {};
  const url = w.doi || loc.landing_page_url || w.id || null;
  return {
    openalexId: shortId(w.id),
    title: (w.title || w.display_name || "").slice(0, 500),
    doi: w.doi ? String(w.doi).replace(/^https?:\/\/doi\.org\//, "") : null,
    year: w.publication_year ?? null,
    venue: (loc.source?.display_name ?? null),
    citationCount: w.cited_by_count ?? null,
    url,
  };
}

async function main() {
  // Pool (not a single Client) so concurrent workers don't share one connection.
  const client = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false }, max: CONCURRENCY + 1 });

  const { rows } = await client.query(`
    select p.id, p.openalex_id
    from public.professors p
    where p.openalex_id is not null
      and not exists (select 1 from public.professor_papers pp where pp.professor_id = p.id)`);
  const work = LIMIT === Infinity ? rows : rows.slice(0, LIMIT);

  let done = 0, withPapers = 0, papersInserted = 0;

  async function one(prof) {
    done++;
    const url = `${BASE}/works?filter=authorships.author.id:${prof.openalex_id}&sort=publication_year:desc&per_page=${PER}&mailto=${MAILTO}`;
    const json = await getJson(url);
    await sleep(200); // throttle to stay under the polite-pool rate limit
    const works = (json?.results ?? []).filter((w) => w.title || w.display_name);
    if (works.length === 0) return;

    const papers = works.map(toPaper).filter((p) => p.openalexId && p.title);
    if (papers.length === 0) return;
    const topCites = Math.max(...papers.map((p) => p.citationCount ?? 0));

    for (const p of papers) {
      // Upsert the paper by openalex_id (dedupe shared papers across coauthors).
      const existing = await client.query("select id from public.papers where openalex_id = $1", [p.openalexId]);
      let paperId = existing.rows[0]?.id;
      if (!paperId) {
        const ins = await client.query(
          `insert into public.papers (title, doi, openalex_id, year, venue, citation_count, url)
           values ($1,$2,$3,$4,$5,$6,$7) returning id`,
          [p.title, p.doi, p.openalexId, p.year, p.venue, p.citationCount, p.url]);
        paperId = ins.rows[0].id;
        papersInserted++;
      }
      await client.query(
        `insert into public.professor_papers (professor_id, paper_id, is_influential, is_recent)
         values ($1,$2,$3,true) on conflict (professor_id, paper_id) do nothing`,
        [prof.id, paperId, (p.citationCount ?? 0) === topCites && topCites > 0]);
    }
    withPapers++;
    if (withPapers % 50 === 0) process.stdout.write(`  …${withPapers} professors with papers / ${done} processed\n`);
  }

  let cursor = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < work.length) {
      const prof = work[cursor++];
      try { await one(prof); } catch { /* skip on error */ }
    }
  }));

  console.log(`\n✓ done. processed ${done}, professors with papers ${withPapers}, new paper rows ${papersInserted}`);
  await client.end();
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
