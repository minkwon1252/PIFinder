// @ts-check
/**
 * Parsers for MIT department faculty rosters (official-page adapter, Phase 3a).
 *
 * Each MIT department site uses its own markup, so parsers are per-page. This is
 * shared by both the TS OfficialPageAdapter (src/lib/sources/official-page.ts)
 * and the ingestion script (scripts/ingest-official.mjs) so the logic lives once.
 *
 * No DOM library — these run in Node and the Next server runtime, so we parse the
 * static HTML with scoped regexes. They degrade gracefully (return [] if the page
 * shape changed) rather than throwing, and they never invent data: a field we
 * can't read is left undefined.
 *
 * @typedef {Object} ParsedFaculty
 * @property {string} fullName
 * @property {string} [title]        Raw title line from the roster.
 * @property {string} [homepageUrl]  Official profile URL.
 * @property {string} [email]
 * @property {string} [areaTag]      Bracketed area tag (e.g. "EE and AI+D"), MIT EECS only.
 * @property {string} [researchIdentity]
 * @property {string[]} researchThemes
 */

/**
 * Collapse whitespace / decode the few HTML entities that appear in names.
 * @param {string | undefined} s
 */
function clean(s) {
  return (s ?? "")
    .replace(/&amp;/g, "&").replace(/&#039;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * MIT EECS people page (https://www.eecs.mit.edu/role/faculty/ and similar).
 * Structure (verified 2026-06): each person is
 *   <h5><a href="…/people/slug/">Name</a></h5>
 *   <p>Title line, [AREA TAG]</p>
 *   … <div class="people-research"><p><a>Theme</a></p>…</div>
 * @param {string} html @param {string} _pageUrl
 * @returns {ParsedFaculty[]}
 */
export function parseMitEecsFaculty(html, _pageUrl) {
  const out = [];
  const entry = /<h5><a href="(https:\/\/www\.eecs\.mit\.edu\/people\/[^"]+)"[^>]*>([^<]+)<\/a><\/h5>/gi;
  const starts = [];
  let m;
  while ((m = entry.exec(html))) starts.push({ idx: m.index, url: m[1], name: m[2] });

  for (let i = 0; i < starts.length; i++) {
    const cur = starts[i];
    if (!cur) continue;
    const next = starts[i + 1];
    const seg = html.slice(cur.idx, next ? next.idx : cur.idx + 4000);
    const titleM = seg.match(/<\/h5>\s*<p>([^<]*)<\/p>/i);
    const title = titleM ? clean(titleM[1]) : undefined;
    const areaM = title && title.match(/\[([^\]]+)\]/);
    const emailM = seg.match(/mailto:([^"'\s>]+@[^"'\s>]+)/i);
    const themes = [...seg.matchAll(/\?fwp_research=[^"]*"[^>]*>([^<]+)<\/a>/gi)]
      .map((t) => clean(t[1]).toLowerCase())
      .filter(Boolean);

    const fullName = clean(cur.name);
    if (!fullName) continue;
    out.push({
      fullName,
      title,
      homepageUrl: cur.url,
      email: emailM ? emailM[1] : undefined,
      areaTag: areaM ? clean(areaM[1]) : undefined,
      researchThemes: [...new Set(themes)].slice(0, 8),
    });
  }
  return out;
}

/**
 * MIT "faculty-teaser" card layout (e.g. DMSE https://dmse.mit.edu/people/faculty/).
 * Structure: <a href="…/people/faculty/slug/"> … <h2 class="faculty-teaser__name">Name</h2>
 *   <div class="faculty-teaser__title">Title</div></a>
 * @param {string} html @param {string} _pageUrl
 * @returns {ParsedFaculty[]}
 */
export function parseMitFacultyTeaser(html, _pageUrl) {
  const out = [];
  const re = /<a href="(https:\/\/[a-z0-9.-]+\.mit\.edu\/people\/faculty\/[^"]+)"[^>]*>[\s\S]*?faculty-teaser__name[^>]*>\s*([^<]+?)\s*<\/h2>\s*<div class="faculty-teaser__title"[^>]*>\s*([^<]*?)\s*<\/div>/gi;
  let m;
  while ((m = re.exec(html))) {
    const fullName = clean(m[2]);
    if (!fullName) continue;
    out.push({
      fullName,
      title: clean(m[3]) || undefined,
      homepageUrl: m[1],
      researchThemes: [],
    });
  }
  return out;
}

/**
 * MIT ChemE (https://cheme.mit.edu/people/faculty/): <h2 class="faculty-name">
 * <a href="…/profile/slug/">Name<i…</a></h2> … faculty-title.
 * @param {string} html @param {string} _pageUrl @returns {ParsedFaculty[]}
 */
export function parseMitChemE(html, _pageUrl) {
  const out = [];
  const re = /<h2 class="faculty-name"><a href="(https:\/\/cheme\.mit\.edu\/[^"]+)"[^>]*>([^<]+?)\s*<(?:i|\/a)/gi;
  const starts = [];
  let m;
  while ((m = re.exec(html))) starts.push({ idx: m.index, url: m[1], name: m[2] });
  for (let i = 0; i < starts.length; i++) {
    const cur = starts[i];
    if (!cur) continue;
    const next = starts[i + 1];
    const seg = html.slice(cur.idx, next ? next.idx : cur.idx + 1500);
    const t = seg.match(/faculty-title[^>]*>\s*([^<]+)/i);
    const fullName = clean(cur.name);
    if (!fullName) continue;
    out.push({ fullName, title: t ? clean(t[1]) : undefined, homepageUrl: cur.url, researchThemes: [] });
  }
  return out;
}

/**
 * MIT CEE (https://cee.mit.edu/people/faculty/): <a href="…/individual/slug/"
 * class="people-item … faculty …"> … <h3>Name</h3> <span class="profile-title">
 * Title</span> <span class="profile-intro">…</span>.
 * @param {string} html @param {string} _pageUrl @returns {ParsedFaculty[]}
 */
export function parseMitCee(html, _pageUrl) {
  const out = [];
  const re = /<a href="([^"]*individual\/[^"]+)" class="people-item[^"]*\bfaculty\b[^"]*">[\s\S]*?<h3>([^<]+)<\/h3>\s*<span class="profile-title">([^<]*)<\/span>(?:\s*<span class="profile-intro">([^<]*)<\/span>)?/gi;
  let m;
  while ((m = re.exec(html))) {
    const fullName = clean(m[2]);
    if (!fullName) continue;
    let url = m[1] ?? "";
    if (url.startsWith("/")) url = `https://cee.mit.edu${url}`;
    out.push({
      fullName,
      title: clean(m[3]) || undefined,
      homepageUrl: url || undefined,
      researchIdentity: clean(m[4]) || undefined,
      researchThemes: [],
    });
  }
  return out;
}

/** Registry of MIT parsers keyed by id. */
export const MIT_PARSERS = {
  "mit-eecs": parseMitEecsFaculty,
  "mit-teaser": parseMitFacultyTeaser,
  "mit-cheme": parseMitChemE,
  "mit-cee": parseMitCee,
};
