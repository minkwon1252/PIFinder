#!/usr/bin/env node
/**
 * Seed REAL professors from OpenAlex (no API key needed; uses the polite pool).
 *
 * Methodology (honest, source-backed — no fabricated professor data):
 *   For each (school, department) we ask OpenAlex for the authors who published
 *   the most works (since 2020) at that institution within the department's
 *   topic field/subfield, grouped by author. We then fetch each author's record
 *   for real metrics (h-index, citations, works), ORCID and research topics, and
 *   keep them ONLY if their *current* OpenAlex institution still matches the
 *   school (drops people who moved away / emeritus). Every professor gets a real
 *   `openalex` source record (url + retrieved_at + confidence). Homepage/lab URLs
 *   are intentionally left null — OpenAlex doesn't provide them and we will not
 *   invent them (the official-page adapter milestone fills those).
 *
 * Re-runnable (idempotent): professors are matched by openalex_id; affiliations
 * are de-duplicated per (professor, school, department); metrics/source are
 * refreshed.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-professors-openalex.mjs
 *   ONLY_SCHOOL=MIT N_PER=4 node --env-file=.env.local scripts/seed-professors-openalex.mjs
 */
import pg from "pg";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) { console.error("ERROR: SUPABASE_DB_URL is not set."); process.exit(1); }
const MAILTO = process.env.OPENALEX_MAILTO || "minkwon@snu.ac.kr";
const N_PER = Number(process.env.N_PER ?? "6");          // top authors per school×dept
const FROM = process.env.FROM_DATE ?? "2020-01-01";       // recency = current faculty
const BASE = "https://api.openalex.org";

// OpenAlex institution IDs for the 7 target schools (verified).
const SCHOOLS = [
  { short: "MIT", inst: "I63966007" },
  { short: "Stanford", inst: "I97018004" },
  { short: "UC Berkeley", inst: "I95457486" },
  { short: "Northwestern", inst: "I111979921" },
  { short: "Caltech", inst: "I122411786" },
  { short: "Princeton", inst: "I20089843" },
  { short: "Harvard", inst: "I136199984" },
].filter((s) => !process.env.ONLY_SCHOOL || s.short === process.env.ONLY_SCHOOL);

// Department abbrev → OpenAlex topic filter. ASJC "field" where a department maps
// cleanly to a whole field; "subfield" to separate engineering subdivisions that
// all share the "Engineering" field.
const DEPTS = {
  MSE:   { kind: "field",    id: 25 },   // Materials Science
  CS:    { kind: "field",    id: 17 },   // Computer Science
  ChemE: { kind: "field",    id: 15 },   // Chemical Engineering
  CHEM:  { kind: "field",    id: 16 },   // Chemistry
  MATH:  { kind: "field",    id: 26 },   // Mathematics
  PHYS:  { kind: "field",    id: 31 },   // Physics and Astronomy
  AP:    { kind: "subfield", id: 3104 }, // Condensed Matter Physics (~applied physics)
  EE:    { kind: "subfield", id: 2208 }, // Electrical and Electronic Engineering
  ME:    { kind: "subfield", id: 2210 }, // Mechanical Engineering
  AeroE: { kind: "subfield", id: 2202 }, // Aerospace Engineering
  BME:   { kind: "subfield", id: 2204 }, // Biomedical Engineering
  CEE:   { kind: "subfield", id: 2205 }, // Civil and Structural Engineering
  ISE:   { kind: "subfield", id: 2209 }, // Industrial and Manufacturing Engineering
  NucE:  { kind: "subfield", id: 2104 }, // Nuclear Energy and Engineering
  BIO:   { kind: "field",    id: 13 },   // Biochemistry, Genetics and Molecular Biology
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shortId = (url) => String(url).split("/").pop();

async function getJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.status === 429) { await sleep(2000); continue; }
      if (!res.ok) return null;
      return await res.json();
    } catch { await sleep(500); }
  }
  return null;
}

// 1) Discover top authors per (school, dept) via works group_by.
async function discover() {
  const slots = []; // { authorId, schoolShort, deptAbbrev }
  for (const school of SCHOOLS) {
    for (const [abbrev, topic] of Object.entries(DEPTS)) {
      const filter = [
        `authorships.institutions.id:${school.inst}`,
        `primary_topic.${topic.kind}.id:${topic.id}`,
        `from_publication_date:${FROM}`,
      ].join(",");
      const url = `${BASE}/works?filter=${filter}&group_by=authorships.author.id&mailto=${MAILTO}`;
      const json = await getJson(url);
      const groups = (json?.group_by ?? [])
        .filter((g) => g.key && !String(g.key).endsWith("/unknown"))
        .slice(0, N_PER);
      for (const g of groups) {
        slots.push({ authorId: shortId(g.key), schoolShort: school.short, deptAbbrev: abbrev });
      }
      process.stdout.write(`  ${school.short}/${abbrev}: ${groups.length}\n`);
      await sleep(120); // polite pool
    }
  }
  return slots;
}

// 2) Fetch author details in batches.
async function fetchAuthors(ids) {
  const out = new Map();
  const chunk = 25;
  for (let i = 0; i < ids.length; i += chunk) {
    const batch = ids.slice(i, i + chunk);
    const url = `${BASE}/authors?filter=openalex_id:${batch.join("|")}&per_page=${chunk}&mailto=${MAILTO}`;
    const json = await getJson(url);
    for (const a of json?.results ?? []) {
      out.set(shortId(a.id), {
        name: a.display_name,
        orcid: a.orcid ? shortId(a.orcid) && a.orcid : null,
        hIndex: a.summary_stats?.h_index ?? null,
        citations: a.cited_by_count ?? null,
        works: a.works_count ?? null,
        topics: (a.topics ?? []).map((t) => t.display_name),
        lastInsts: (a.last_known_institutions ?? []).map((x) => shortId(x.id)),
      });
    }
    await sleep(120);
  }
  return out;
}

async function main() {
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Resolve DB ids for schools (by short_name) and departments (by abbrev).
  const schoolRows = (await client.query("select id, short_name from public.schools")).rows;
  const deptRows = (await client.query("select id, abbrev from public.departments")).rows;
  const schoolDbId = new Map(schoolRows.map((r) => [r.short_name, r.id]));
  const deptDbId = new Map(deptRows.map((r) => [r.abbrev, r.id]));
  const instToShort = new Map(SCHOOLS.map((s) => [s.inst, s.short]));

  console.log(`Discovering authors (${SCHOOLS.length} schools × ${Object.keys(DEPTS).length} depts, top ${N_PER})…`);
  const slots = await discover();
  const uniqueIds = [...new Set(slots.map((s) => s.authorId))];
  console.log(`\nFetching details for ${uniqueIds.length} unique authors…`);
  const authors = await fetchAuthors(uniqueIds);

  let profCreated = 0, affilCreated = 0, skippedMoved = 0;
  const profIdByOa = new Map();

  for (const slot of slots) {
    const a = authors.get(slot.authorId);
    if (!a || !a.name) continue;

    // Currency check: keep only if still at this institution (when known).
    const schoolInst = SCHOOLS.find((s) => s.short === slot.schoolShort).inst;
    if (a.lastInsts.length && !a.lastInsts.includes(schoolInst)) { skippedMoved++; continue; }

    const schoolId = schoolDbId.get(slot.schoolShort);
    const deptId = deptDbId.get(slot.deptAbbrev);
    if (!schoolId || !deptId) continue;

    // Professor: get-or-create by openalex_id.
    let profId = profIdByOa.get(slot.authorId);
    if (!profId) {
      const existing = await client.query("select id from public.professors where openalex_id = $1", [slot.authorId]);
      if (existing.rows[0]) {
        profId = existing.rows[0].id;
      } else {
        const themes = [...new Set(a.topics.map((t) => t.toLowerCase()))].slice(0, 6);
        const identity = a.topics.length
          ? `Active in: ${a.topics.slice(0, 3).join("; ")} (top OpenAlex research topics, ${FROM.slice(0, 4)}–present).`
          : null;
        const ins = await client.query(
          `insert into public.professors (full_name, research_identity, openalex_id, orcid, research_themes)
           values ($1, $2, $3, $4, $5) returning id`,
          [a.name, identity, slot.authorId, a.orcid, themes],
        );
        profId = ins.rows[0].id;
        profCreated++;
      }
      profIdByOa.set(slot.authorId, profId);

      // Source (one openalex record per professor) — refresh.
      await client.query("delete from public.professor_sources where professor_id = $1 and source_type = 'openalex'", [profId]);
      const src = await client.query(
        `insert into public.professor_sources (professor_id, source_type, source_url, confidence, raw_excerpt)
         values ($1, 'openalex', $2, 0.70, $3) returning id`,
        [profId, `https://openalex.org/${slot.authorId}`, "Author metrics & topics from OpenAlex (real, auto-derived)."],
      );
      // Metrics — refresh.
      await client.query("delete from public.professor_metrics where professor_id = $1", [profId]);
      await client.query(
        `insert into public.professor_metrics (professor_id, citation_count, h_index, works_count, source_id)
         values ($1, $2, $3, $4, $5)`,
        [profId, a.citations, a.hIndex, a.works, src.rows[0].id],
      );
    }

    // Affiliation: de-dup per (professor, school, dept).
    const aff = await client.query(
      "select 1 from public.professor_affiliations where professor_id=$1 and school_id=$2 and department_id=$3",
      [profId, schoolId, deptId],
    );
    if (!aff.rows[0]) {
      await client.query(
        `insert into public.professor_affiliations (professor_id, school_id, department_id, title, is_primary)
         values ($1, $2, $3, null, $4)`,
        [profId, schoolId, deptId, affilCreated === 0],
      );
      affilCreated++;
    }
  }

  const total = (await client.query("select count(*)::int n from public.professors where openalex_id is not null")).rows[0].n;
  console.log(`\n✓ done. professors created this run: ${profCreated}, affiliations created: ${affilCreated}, skipped (moved): ${skippedMoved}`);
  console.log(`  real (openalex-sourced) professors in DB: ${total}`);
  await client.end();
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
