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

/** Registry of MIT parsers keyed by id. */
export const MIT_PARSERS = {
  "mit-eecs": parseMitEecsFaculty,
};
