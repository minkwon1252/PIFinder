// @ts-check
/**
 * Parser for Stanford department faculty, sourced from the Drupal JSON:API that
 * Stanford School-of-Engineering department sites expose at
 *   https://<dept>.stanford.edu/jsonapi/node/stanford_person
 * (verified for mse, cheme, aa, bioengineering — 2026-06). This avoids needing a
 * headless browser: the department pages are JS-rendered, but their data is right
 * here as structured JSON.
 *
 * We keep only professorial faculty (title contains "Professor") and drop
 * emeritus/lecturer/visiting/adjunct/etc. Nothing is invented — fields the API
 * doesn't provide are left undefined.
 *
 * @typedef {import("./mit.mjs").ParsedFaculty} ParsedFaculty
 */

/** @param {string | undefined} s */
const clean = (s) =>
  (s ?? "").replace(/&amp;/g, "&").replace(/&#0?39;|&rsquo;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
/** @param {string | undefined} s */
const stripTags = (s) =>
  clean(String(s ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+([.,;:!?])/g, "$1");

const IS_FACULTY = /professor/i;
const EXCLUDE = /emerit|lecturer|postdoctoral|post-doctoral|adjunct|visiting|consulting|acting\s+(assistant|associate)|instructor|\bstaff\b/i;

/**
 * Parse one JSON:API page object → faculty.
 * @param {any} json @returns {ParsedFaculty[]}
 */
export function parseStanfordPersonsObj(json) {
  const out = [];
  for (const node of json?.data ?? []) {
    const a = node?.attributes ?? {};
    const fullName = clean(a.title);
    const title = clean(a.su_person_full_title || a.su_person_short_title);
    if (!fullName) continue;
    if (!IS_FACULTY.test(title) || EXCLUDE.test(title)) continue;

    const link = a.su_person_profile_link;
    const homepageUrl =
      (link && typeof link === "object" ? link.uri : typeof link === "string" ? link : undefined) || undefined;
    const ri = a.su_person_research_interests?.value || a.su_person_scholarly_interests?.value || "";
    const identity = ri ? stripTags(ri).slice(0, 300) : undefined;

    out.push({
      fullName,
      title,
      homepageUrl,
      email: a.su_person_email || undefined,
      researchIdentity: identity,
      researchThemes: [],
    });
  }
  return out;
}

/**
 * Text wrapper (matches the (text,url) parser contract used by the adapter).
 * @param {string} text @returns {ParsedFaculty[]}
 */
export function parseStanfordPersons(text) {
  try {
    return parseStanfordPersonsObj(JSON.parse(text));
  } catch {
    return [];
  }
}

/**
 * Stanford EE (https://ee.stanford.edu/people/faculty) — "orglist" HTML layout.
 * <h3 class="orglist__display-name"><a href="profiles.stanford.edu/…">Name</a>
 *   <small class="orglist__person-title">Title</small></h3>
 * @param {string} html @returns {ParsedFaculty[]}
 */
export function parseStanfordEe(html) {
  const out = [];
  // Note: the EE page is partly JS-rendered (only ~10 faculty in static HTML);
  // OpenAlex covers the rest. Profile links may be Stanford Profiles or lab sites.
  const re = /orglist__display-name"><a href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>\s*<small class="orglist__person-title[^"]*">\s*([^<]*?)\s*<\/small>/gi;
  let m;
  while ((m = re.exec(html))) {
    const fullName = clean(m[2]);
    const title = clean(m[3]);
    if (!fullName || /emerit/i.test(title)) continue;
    out.push({ fullName, title: title || undefined, homepageUrl: m[1], researchThemes: [] });
  }
  return out;
}

/**
 * Stanford Humanities & Sciences "hb-card" layout (physics, biology — 2026-06).
 * hb-card__title → <a href="/people/slug">Name</a>; hb-subtitle → title. Links
 * are relative, so the page URL supplies the origin.
 * @param {string} html @param {string} pageUrl @returns {ParsedFaculty[]}
 */
export function parseStanfordHbCard(html, pageUrl) {
  let origin = "";
  try { origin = new URL(pageUrl).origin; } catch { /* keep relative */ }
  const out = [];
  const starts = [];
  const sre = /hb-card__title">/gi;
  let m;
  while ((m = sre.exec(html))) starts.push(m.index);
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    if (start == null) continue;
    const seg = html.slice(start, (starts[i + 1] ?? start + 1200));
    const a = seg.match(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
    if (!a) continue;
    const fullName = clean(a[2]);
    if (!fullName) continue;
    const t = seg.match(/hb-subtitle">([^<]*)</i);
    const title = t ? clean(t[1]) : undefined;
    if (title && /emerit/i.test(title)) continue;
    let url = a[1] ?? "";
    if (url.startsWith("/")) url = origin + url;
    out.push({ fullName, title, homepageUrl: url || undefined, researchThemes: [] });
  }
  return out;
}
