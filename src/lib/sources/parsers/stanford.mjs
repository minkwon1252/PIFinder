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
