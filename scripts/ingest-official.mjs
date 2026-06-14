#!/usr/bin/env node
/**
 * Ingest REAL faculty from official department pages (Phase 3a, official-page
 * adapter). Authoritative for affiliation + title + homepage URL.
 *
 * For each configured roster: fetch → parse (shared parsers in
 * src/lib/sources/parsers/) → for each faculty, match an existing professor in
 * that school by name (upgrading them: fill homepage_url, set a verified
 * `department_page` source + affiliation/title) or INSERT a roster-only
 * professor (the roster is authoritative for who is faculty). Idempotent.
 *
 * No fabrication: fields the page doesn't provide are left null/missing.
 *
 * Usage:
 *   node --env-file=.env.local scripts/ingest-official.mjs
 */
import pg from "pg";
import { MIT_PARSERS } from "../src/lib/sources/parsers/mit.mjs";
import { parseStanfordPersonsObj } from "../src/lib/sources/parsers/stanford.mjs";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) { console.error("ERROR: SUPABASE_DB_URL is not set."); process.exit(1); }
const UA = "PIFinderBot/0.1 (+https://pi-finder-ten.vercel.app; SNU STEM research project)";

// EECS is one department spanning CS + EE; route each person by their area tag.
function routeEecs(areaTag) {
  const a = (areaTag || "").toUpperCase();
  const depts = [];
  if (a.includes("EE")) depts.push("EE");
  if (a.includes("CS") || a.includes("AI")) depts.push("CS");
  return depts.length ? depts : ["CS", "EE"]; // unknown → both (EECS spans both)
}

// Registered rosters. `kind` html → parsed by MIT_PARSERS[parser]; json → Stanford
// JSON:API (paginated). `route(areaTag)` returns dept abbrevs; or fixed `dept`.
const SP = (sub) => `https://${sub}.stanford.edu/jsonapi/node/stanford_person?page%5Blimit%5D=50`;
const SOURCES = [
  // MIT
  { schoolShort: "MIT", kind: "html", url: "https://www.eecs.mit.edu/role/faculty/", parser: "mit-eecs", route: routeEecs },
  { schoolShort: "MIT", kind: "html", url: "https://dmse.mit.edu/people/faculty/", parser: "mit-teaser", dept: "MSE" },
  // Stanford (Drupal JSON:API)
  { schoolShort: "Stanford", kind: "json", url: SP("mse"), dept: "MSE" },
  { schoolShort: "Stanford", kind: "json", url: SP("cheme"), dept: "ChemE" },
  { schoolShort: "Stanford", kind: "json", url: SP("aa"), dept: "AeroE" },
  { schoolShort: "Stanford", kind: "json", url: SP("bioengineering"), dept: "BME" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Normalize a name for matching: lowercase, strip accents/punctuation.
const norm = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[.''`]/g, "").replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();
const firstLast = (s) => { const t = norm(s).split(" "); return t.length >= 2 ? `${t[0]} ${t[t.length - 1]}` : norm(s); };

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/vnd.api+json" }, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Stanford JSON:API → all faculty, following pagination.
async function fetchStanford(url) {
  const faculty = [];
  let next = url, pages = 0;
  while (next && pages < 20) {
    const json = await fetchJson(next);
    faculty.push(...parseStanfordPersonsObj(json));
    next = json?.links?.next?.href ?? null;
    pages++;
    await sleep(300);
  }
  return faculty;
}

async function main() {
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const schoolId = new Map((await client.query("select id, short_name from public.schools")).rows.map((r) => [r.short_name, r.id]));
  const deptId = new Map((await client.query("select id, abbrev from public.departments")).rows.map((r) => [r.abbrev, r.id]));

  let totMatched = 0, totInserted = 0, totAffil = 0, totHomepage = 0, totFaculty = 0;

  for (const src of SOURCES) {
    const sId = schoolId.get(src.schoolShort);
    if (!sId) { console.warn(`! unknown school ${src.schoolShort}`); continue; }
    process.stdout.write(`\n→ ${src.schoolShort} ${src.url}\n`);

    let faculty;
    try {
      faculty = src.kind === "json"
        ? await fetchStanford(src.url)
        : MIT_PARSERS[src.parser](await fetchHtml(src.url), src.url);
    } catch (e) { console.warn(`  ✗ fetch/parse failed: ${e.message}`); continue; }
    console.log(`  parsed ${faculty.length} faculty`);
    totFaculty += faculty.length;

    // Existing professors affiliated with this school → name lookup.
    const existing = (await client.query(
      `select distinct p.id, p.full_name, p.homepage_url
       from public.professors p
       join public.professor_affiliations a on a.professor_id = p.id
       where a.school_id = $1`, [sId])).rows;
    const byFull = new Map(); const byFL = new Map();
    for (const r of existing) { byFull.set(norm(r.full_name), r); byFL.set(firstLast(r.full_name), r); }

    for (const f of faculty) {
      const match = byFull.get(norm(f.fullName)) ?? byFL.get(firstLast(f.fullName));
      let profId;
      if (match) {
        profId = match.id;
        totMatched++;
        if (!match.homepage_url && f.homepageUrl) {
          await client.query("update public.professors set homepage_url = $1, updated_at = now() where id = $2", [f.homepageUrl, profId]);
          totHomepage++;
        }
      } else {
        const ins = await client.query(
          `insert into public.professors (full_name, research_identity, homepage_url, research_themes) values ($1, $2, $3, $4) returning id`,
          [f.fullName, f.researchIdentity ?? null, f.homepageUrl ?? null, f.researchThemes ?? []]);
        profId = ins.rows[0].id;
        totInserted++;
        // register so a person on multiple dept-routes isn't inserted twice
        byFull.set(norm(f.fullName), { id: profId, homepage_url: f.homepageUrl });
        byFL.set(firstLast(f.fullName), { id: profId, homepage_url: f.homepageUrl });
      }

      // Authoritative department_page source (one per prof+url).
      const hasSrc = await client.query(
        "select 1 from public.professor_sources where professor_id=$1 and source_type='department_page' and source_url=$2", [profId, src.url]);
      if (!hasSrc.rows[0]) {
        await client.query(
          `insert into public.professor_sources (professor_id, source_type, source_url, confidence, raw_excerpt)
           values ($1, 'department_page', $2, 0.90, $3)`, [profId, src.url, f.title ?? null]);
      }

      // Verified affiliation per department (routed by area tag, or fixed).
      const depts = src.route ? src.route(f.areaTag) : [src.dept];
      for (const abbrev of depts) {
        const dId = deptId.get(abbrev);
        if (!dId) continue;
        const aff = await client.query(
          "select id from public.professor_affiliations where professor_id=$1 and school_id=$2 and department_id=$3", [profId, sId, dId]);
        if (aff.rows[0]) {
          await client.query("update public.professor_affiliations set title = coalesce($1, title) where id = $2", [f.title ?? null, aff.rows[0].id]);
        } else {
          await client.query(
            `insert into public.professor_affiliations (professor_id, school_id, department_id, title, is_primary)
             values ($1, $2, $3, $4, false)`, [profId, sId, dId, f.title ?? null]);
        }
        totAffil++;
      }
    }
  }

  console.log(`\n✓ done. parsed ${totFaculty} faculty | matched existing ${totMatched}, inserted new ${totInserted}, homepages filled ${totHomepage}, affiliations upserted ${totAffil}`);
  await client.end();
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
