#!/usr/bin/env node
/**
 * Milestone 3b — enrich roster-only professors (those with a verified
 * official-page affiliation but no OpenAlex match yet) with REAL metrics from
 * OpenAlex: h-index, citations, works, ORCID, research topics.
 *
 * Matching is CONSERVATIVE (no fabrication / no misattribution):
 *   - Query OpenAlex authors by name, filtered to the professor's institution.
 *   - Accept only an exact normalized full-name match (one candidate), or a
 *     single first+last match. Ambiguous (multiple) matches are SKIPPED.
 *   - On a confident match, attach openalex_id + orcid + themes + an `openalex`
 *     source + metrics. No match → metrics stay missing (not zero).
 *
 * Idempotent: only professors with openalex_id IS NULL are processed.
 *
 * Usage:
 *   node --env-file=.env.local scripts/enrich-professors.mjs
 *   LIMIT=20 node --env-file=.env.local scripts/enrich-professors.mjs   # sample
 */
import pg from "pg";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) { console.error("ERROR: SUPABASE_DB_URL is not set."); process.exit(1); }
const MAILTO = process.env.OPENALEX_MAILTO || "minkwon@snu.ac.kr";
const BASE = "https://api.openalex.org";
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;

// OpenAlex institution IDs (must match the school short_names in the DB).
const INST = {
  MIT: "I63966007", Stanford: "I97018004", "UC Berkeley": "I95457486",
  Northwestern: "I111979921", Caltech: "I122411786", Princeton: "I20089843", Harvard: "I136199984",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shortId = (u) => String(u).split("/").pop();
const norm = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[.'`’]/g, "").replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();
const firstLast = (s) => { const t = norm(s).split(" ").filter(Boolean); return t.length >= 2 ? `${t[0]} ${t[t.length - 1]}` : norm(s); };
// Strip trailing credentials so "Joseph Woo, MD, FACS" matches "Joseph Woo".
const stripCreds = (s) => s.replace(/,\s*(MD|PhD|MS|MBA|FACS|FACC|FAHA|ScD|MPH|DPhil|Jr\.?|Sr\.?|III|II)\b.*$/i, "").trim();

async function getJson(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000), // never hang on a stalled connection
      });
      if (res.status === 429) { await sleep(2000); continue; }
      if (!res.ok) return null;
      return await res.json();
    } catch { await sleep(500); }
  }
  return null;
}

/**
 * Find a confident OpenAlex author match for a name at an institution.
 * Strategy: among same-name authors AT THIS INSTITUTION, pick the most
 * productive (faculty are productive; this rescues e.g. "Andrew W. Lo" over a
 * sparse "Andrew Lo" homonym). Require a minimum output so we don't attach a
 * trivial wrong author. Exact full-name match scores higher than first+last.
 */
async function matchAuthor(name, instId) {
  const q = encodeURIComponent(stripCreds(name));
  const url = `${BASE}/authors?filter=affiliations.institution.id:${instId}&search=${q}&per_page=10&mailto=${MAILTO}`;
  const json = await getJson(url);
  const results = json?.results ?? [];
  if (results.length === 0) return null;

  const target = norm(stripCreds(name));
  const targetFL = firstLast(stripCreds(name));

  // Candidates whose name is compatible (prefer exact, fall back to first+last).
  const exact = results.filter((a) => norm(a.display_name) === target);
  let cands = exact.length ? exact : results.filter((a) => firstLast(a.display_name) === targetFL);
  if (cands.length === 0) return null;

  // The roster faculty member is the most-productive same-name author here.
  cands.sort((a, b) => (b.works_count ?? 0) - (a.works_count ?? 0));
  const best = cands[0];
  if ((best.works_count ?? 0) < 3) return null; // too sparse → not confident it's the professor

  const confidence = norm(best.display_name) === target ? 0.85 : 0.7;
  return { author: best, confidence };
}

async function main() {
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Roster-only professors (no OpenAlex yet) + their primary school.
  const { rows } = await client.query(`
    select distinct on (p.id) p.id, p.full_name, p.research_themes, p.research_identity, p.orcid, s.short_name school
    from public.professors p
    join public.professor_affiliations a on a.professor_id = p.id
    join public.schools s on s.id = a.school_id
    where p.openalex_id is null
    order by p.id, a.is_primary desc`);

  let matched = 0, skipped = 0, processed = 0;
  for (const p of rows) {
    if (processed >= LIMIT) break;
    processed++;
    const instId = INST[p.school];
    if (!instId) { skipped++; continue; }

    const hit = await matchAuthor(p.full_name, instId);
    await sleep(120); // polite pool
    if (!hit) { skipped++; continue; }
    const a = hit.author;
    const oaId = shortId(a.id);

    // Guard: don't collide with an openalex_id already used by another professor.
    const taken = await client.query("select 1 from public.professors where openalex_id = $1 and id <> $2", [oaId, p.id]);
    if (taken.rows[0]) { skipped++; continue; }

    const themes = (p.research_themes && p.research_themes.length)
      ? p.research_themes
      : [...new Set((a.topics ?? []).map((t) => String(t.display_name).toLowerCase()))].slice(0, 6);
    const identity = p.research_identity
      || ((a.topics ?? []).length ? `Active in: ${a.topics.slice(0, 3).map((t) => t.display_name).join("; ")} (top OpenAlex research topics).` : null);

    await client.query(
      `update public.professors set openalex_id = $1, orcid = coalesce(orcid, $2),
         research_themes = $3, research_identity = coalesce(research_identity, $4), updated_at = now()
       where id = $5`,
      [oaId, a.orcid ?? null, themes, identity, p.id]);

    // openalex source + metrics (refresh any prior openalex rows for this prof).
    await client.query("delete from public.professor_sources where professor_id=$1 and source_type='openalex'", [p.id]);
    const src = await client.query(
      `insert into public.professor_sources (professor_id, source_type, source_url, confidence, raw_excerpt)
       values ($1, 'openalex', $2, $3, $4) returning id`,
      [p.id, `https://openalex.org/${oaId}`, hit.confidence, `Matched to OpenAlex by name + institution (confidence ${hit.confidence}).`]);
    await client.query("delete from public.professor_metrics where professor_id=$1", [p.id]);
    await client.query(
      `insert into public.professor_metrics (professor_id, citation_count, h_index, works_count, source_id)
       values ($1, $2, $3, $4, $5)`,
      [p.id, a.cited_by_count ?? null, a.summary_stats?.h_index ?? null, a.works_count ?? null, src.rows[0].id]);

    matched++;
    if (matched % 50 === 0) process.stdout.write(`  …${matched} matched / ${processed} processed\n`);
  }

  console.log(`\n✓ done. processed ${processed}, matched ${matched}, skipped (no confident match) ${skipped}`);
  const left = await client.query("select count(*)::int n from public.professors where openalex_id is null");
  console.log(`  professors still without metrics: ${left.rows[0].n}`);
  await client.end();
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
