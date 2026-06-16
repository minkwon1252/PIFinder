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
