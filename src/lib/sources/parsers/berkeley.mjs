// @ts-check
/**
 * Parser for UC Berkeley department faculty rosters built on the WordPress
 * "Beaver Builder" post-grid theme (e.g. https://mse.berkeley.edu/people/faculty/).
 * Each faculty card is:
 *   <h2 class="fl-post-grid-title"><a href="…/people_new/slug/">Name</a></h2>
 * No per-card title in the grid, so titles are left undefined (not invented).
 *
 * @typedef {import("./mit.mjs").ParsedFaculty} ParsedFaculty
 */

/** @param {string | undefined} s */
const clean = (s) =>
  (s ?? "").replace(/&amp;/g, "&").replace(/&#0?39;|&rsquo;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();

/**
 * WordPress post-grid (e.g. mse.berkeley.edu).
 * @param {string} html @returns {ParsedFaculty[]}
 */
export function parseBerkeleyGrid(html) {
  const out = [];
  const re = /<h2 class="fl-post-grid-title"[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const fullName = clean(m[2]);
    if (!fullName) continue;
    out.push({ fullName, homepageUrl: m[1], researchThemes: [] });
  }
  return out;
}

/**
 * Berkeley EECS (www2.eecs.berkeley.edu/Faculty/Lists/faculty.html): each
 * faculty links to /Faculty/Homepages/slug.html. Covers EE + CS.
 * @param {string} html @returns {ParsedFaculty[]}
 */
export function parseBerkeleyEecs(html) {
  const out = [];
  const seen = new Set();
  const re = /<a href="(\/Faculty\/Homepages\/[A-Za-z0-9._-]+\.html)"[^>]*>([A-Z][^<]{2,50})<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const fullName = clean(m[2]);
    if (!fullName || seen.has(fullName)) continue;
    seen.add(fullName);
    out.push({ fullName, homepageUrl: `https://www2.eecs.berkeley.edu${m[1]}`, researchThemes: [] });
  }
  return out;
}

const NONFAC = /\/(graduate-student|graduate|staff|postdoc|post-doc|emeriti|emeritus|lecturer|researcher|visitor|visiting)\b/i;

/**
 * Berkeley "OpenBerkeley" Drupal theme (e.g. physics, chemistry). Faculty rows
 * have views-field-title → <a href="/people/slug">Name</a>. Non-faculty (grad
 * students/staff/emeriti) are filtered out by their URL path.
 * @param {string} html @param {string} pageUrl @returns {ParsedFaculty[]}
 */
export function parseOpenBerkeley(html, pageUrl) {
  let origin = "";
  try { origin = new URL(pageUrl).origin; } catch { /* relative */ }
  const out = [];
  const seen = new Set();
  const re = /views-field-title[\s\S]{0,1500}?<a href="(\/people\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = m[1] ?? "";
    if (NONFAC.test(url)) continue;
    const fullName = clean(m[2]);
    if (!fullName || seen.has(fullName)) continue;
    seen.add(fullName);
    out.push({ fullName, homepageUrl: origin + url, researchThemes: [] });
  }
  return out;
}
