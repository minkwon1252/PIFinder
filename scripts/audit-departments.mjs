#!/usr/bin/env node
/**
 * Systematic department re-audit for OpenAlex-INFERRED professors only.
 *
 * Official-page (department_page) affiliations are authoritative and never
 * touched. For the rest, we re-derive a department from the professor's actual
 * OpenAlex research topics and correct clear mismatches.
 *
 * IMPORTANT LIMITATION: OpenAlex's topic taxonomy doesn't map cleanly to
 * academic departments (e.g. it labels battery-materials work as "Electrical
 * Engineering"). So this is conservative + high-precision:
 *   - field-level vote across top topics (science fields → their dept;
 *     Engineering field → its subfield's dept);
 *   - a targeted rescue: an engineering-bucketed professor whose topics are
 *     clearly materials-science (and have a Materials Science field topic) → MSE.
 *   - only reassigns when the derived dept is confident AND differs from all of
 *     the professor's current departments.
 *
 * This is a REVIEW tool — dry-run by default. OpenAlex topic→department mapping
 * is not reliable enough to apply blindly (interdisciplinary researchers tag
 * ambiguously), so use the output for human review. Set APPLY=1 only after
 * checking the proposed changes.
 *
 * Usage:
 *   node --env-file=.env.local scripts/audit-departments.mjs               # report only (default)
 *   MODE=all node --env-file=.env.local scripts/audit-departments.mjs      # include field-vote moves
 *   APPLY=1 node --env-file=.env.local scripts/audit-departments.mjs       # apply (materials rescue only)
 */
import pg from "pg";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) { console.error("ERROR: SUPABASE_DB_URL not set."); process.exit(1); }
const MAILTO = process.env.OPENALEX_MAILTO || "minkwon@snu.ac.kr";
const DRY = !process.env.APPLY; // dry-run unless APPLY is set

const num = (u) => (u ? Number(String(u).split("/").pop()) : null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// MODE=materials → only apply the high-precision "materials rescue" (eng→MSE).
// Bulk field-vote moves are unreliable (e.g. computational chemists tagged as
// physics), so they are NOT applied by default.
const MATERIALS_ONLY = (process.env.MODE ?? "materials") === "materials";

// Inverse of the seed mapping (lib seed-professors-openalex.mjs DEPTS).
const FIELD_TO_DEPT = { 25: "MSE", 17: "CS", 15: "ChemE", 16: "CHEM", 26: "MATH", 31: "PHYS", 13: "BIO", 11: "BIO" };
const SUBFIELD_TO_DEPT = { 2208: "EE", 2210: "ME", 2202: "AeroE", 2204: "BME", 2205: "CEE", 2209: "ISE", 2104: "NucE", 3104: "AP" };
const ENG = new Set(["EE", "ME", "AeroE", "BME", "CEE", "ISE", "NucE"]);
const MATERIALS_RE = /\bmaterials?\b|battery materials|\balloy|ceramic|crystallin|metallurg|corrosion|nanomaterial|thin[- ]film|solid[- ]state electrolyte|electrode material/i;

function deptForTopic(t) {
  const fid = num(t.field?.id), sid = num(t.subfield?.id);
  if (FIELD_TO_DEPT[fid]) return FIELD_TO_DEPT[fid];     // science fields win
  if (SUBFIELD_TO_DEPT[sid]) return SUBFIELD_TO_DEPT[sid]; // engineering subfields, AP
  return null;
}

/** Returns { dept, confidence } or null. */
function deriveDept(topics) {
  const top = (topics ?? []).slice(0, 8);
  if (top.length === 0) return null;
  const votes = {};
  top.forEach((t, i) => {
    const d = deptForTopic(t);
    if (d) votes[d] = (votes[d] ?? 0) + (8 - i); // rank-weighted
  });
  const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return null;
  let [dept, score] = ranked[0];
  const totalW = Object.values(votes).reduce((a, b) => a + b, 0);

  // Materials rescue: engineering-bucketed prof whose topics are clearly
  // materials-science (≥2 materials topics + a Materials Science field topic).
  const matCount = top.filter((t) => MATERIALS_RE.test(t.display_name ?? "")).length;
  const hasMatField = top.some((t) => num(t.field?.id) === 25);
  if (ENG.has(dept) && matCount >= 2 && hasMatField) {
    return { dept: "MSE", confidence: 0.9, reason: "materials rescue" };
  }
  return { dept, confidence: score / Math.max(1, totalW), reason: "field vote" };
}

async function fetchTopics(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 40) {
    const batch = ids.slice(i, i + 40);
    const url = `https://api.openalex.org/authors?filter=openalex_id:${batch.join("|")}&per_page=40&mailto=${MAILTO}`;
    for (let a = 0; a < 4; a++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
        if (res.status === 429) { await sleep(1500 * (a + 1)); continue; }
        if (!res.ok) break;
        const j = await res.json();
        for (const au of j.results ?? []) out.set(String(au.id).split("/").pop(), au.topics ?? []);
        break;
      } catch { await sleep(800); }
    }
    await sleep(150);
  }
  return out;
}

async function main() {
  const c = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Professors WITHOUT an authoritative official-page source (inferred only).
  const { rows: profs } = await c.query(`
    select p.id, p.openalex_id, p.full_name
    from public.professors p
    where p.openalex_id is not null
      and not exists (select 1 from public.professor_sources s where s.professor_id=p.id and s.source_type='department_page')`);
  console.log(`Inferred (OpenAlex-only) professors: ${profs.length}`);

  const topicsById = await fetchTopics(profs.map((p) => p.openalex_id));
  const deptId = new Map((await c.query("select id, abbrev from public.departments")).rows.map((r) => [r.abbrev, r.id]));

  let changed = 0, examined = 0, noData = 0;
  const migrations = {};
  const samples = [];

  for (const p of profs) {
    const topics = topicsById.get(p.openalex_id);
    if (!topics || topics.length === 0) { noData++; continue; }
    const derived = deriveDept(topics);
    if (!derived || derived.confidence < 0.45) continue;
    // Only the targeted materials rescue is precise enough to apply.
    if (MATERIALS_ONLY && derived.reason !== "materials rescue") continue;
    examined++;

    const { rows: affs } = await c.query(
      "select a.id, a.is_primary, d.abbrev from public.professor_affiliations a join public.departments d on d.id=a.department_id where a.professor_id=$1",
      [p.id]);
    const curDepts = new Set(affs.map((a) => a.abbrev));
    if (curDepts.has(derived.dept)) continue; // already in the right dept
    const targetId = deptId.get(derived.dept);
    if (!targetId || affs.length === 0) continue;

    const fromAbbrev = (affs.find((a) => a.is_primary) ?? affs[0]).abbrev;
    const affToChange = (affs.find((a) => a.is_primary) ?? affs[0]).id;
    migrations[`${fromAbbrev}→${derived.dept}`] = (migrations[`${fromAbbrev}→${derived.dept}`] ?? 0) + 1;
    if (samples.length < 25) samples.push(`${p.full_name}: ${fromAbbrev} → ${derived.dept} (${derived.reason})`);

    if (!DRY) {
      await c.query("update public.professor_affiliations set department_id=$1 where id=$2", [targetId, affToChange]);
    }
    changed++;
  }

  console.log(`\n${DRY ? "[DRY RUN] " : ""}examined ${examined}, no-topic-data ${noData}, ${DRY ? "would change" : "changed"} ${changed}`);
  console.log("\nMigrations (from→to: count):");
  Object.entries(migrations).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log("\nSample:");
  samples.forEach((s) => console.log("  -", s));
  await c.end();
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
