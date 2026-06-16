import type {
  ProfessorRecord,
  ProfessorSearchQuery,
  ProfessorSourceAdapter,
} from "./types";
// Shared, Node+Next-portable parsers (also used by scripts/ingest-official.mjs).
import { MIT_PARSERS } from "./parsers/mit.mjs";
import { parseStanfordPersons, parseStanfordEe, parseStanfordHbCard } from "./parsers/stanford.mjs";
import { parseBerkeleyGrid } from "./parsers/berkeley.mjs";

/** Combined parser registry. Each parser takes (responseText, url) → faculty. */
const PARSERS = {
  ...MIT_PARSERS,
  stanford: parseStanfordPersons,
  "stanford-ee": parseStanfordEe,
  "stanford-hbcard": parseStanfordHbCard,
  "berkeley-grid": parseBerkeleyGrid,
};

/**
 * Official department/lab page adapter (Phase 3a).
 *
 * Source of record for affiliation + roster membership. Faculty rosters vary per
 * university, so parsing is per-page via a registry; an entry maps a department
 * page URL to a parser id. Implemented so far:
 *   - MIT EECS ("mit-eecs") and MIT faculty-teaser sites ("mit-teaser") — static HTML.
 *   - Stanford ("stanford") — department Drupal JSON:API (response is JSON; the parser
 *     JSON-parses the text). This single fetch reads the first page only; the ingestion
 *     script (scripts/ingest-official.mjs) follows JSON:API pagination.
 *
 * Unregistered school+dept pairs return [] — we never invent roster data. Every
 * emitted professor carries a `department_page` source.
 *
 * Compliance: a descriptive User-Agent is sent, requests time out, and callers
 * should cache (the ingestion script does). robots.txt permits these paths.
 */

const UA = "PIFinderBot/0.1 (+https://pi-finder-ten.vercel.app; SNU STEM research project)";

/** url + which parser handles it, keyed by `${schoolShort}|${deptAbbrev}`. */
export interface OfficialPageEntry {
  schoolShort: string;
  deptAbbrev: string;
  url: string;
  parser: keyof typeof PARSERS;
}

export class OfficialPageAdapter implements ProfessorSourceAdapter {
  readonly id = "official_page";

  constructor(private entries: OfficialPageEntry[] = []) {}

  /** Find the registered entry for a query, if any. */
  private entryFor(query: ProfessorSearchQuery): OfficialPageEntry | undefined {
    return this.entries.find(
      (e) => e.schoolShort === query.schoolName && e.deptAbbrev === query.departmentAbbrev,
    );
  }

  async search(query: ProfessorSearchQuery): Promise<ProfessorRecord[]> {
    const entry = this.entryFor(query);
    if (!entry) return []; // no registered roster for this school+dept → nothing invented

    const parse = PARSERS[entry.parser];
    if (!parse) return [];

    let html: string;
    try {
      const res = await fetch(entry.url, {
        headers: { "User-Agent": UA, Accept: "text/html" },
        signal: AbortSignal.timeout(25_000),
        next: { revalidate: 7 * 24 * 3600 }, // cache a week (Next runtime)
      });
      if (!res.ok) return [];
      html = await res.text();
    } catch {
      return []; // network/timeout → graceful empty, not a thrown run
    }

    const now = new Date().toISOString();
    return parse(html, entry.url).map((f): ProfessorRecord => ({
      fullName: f.fullName,
      homepageUrl: f.homepageUrl,
      researchThemes: f.researchThemes ?? [],
      schoolName: query.schoolName,
      departmentAbbrev: query.departmentAbbrev,
      title: f.title,
      sources: [
        {
          sourceType: "department_page",
          sourceUrl: entry.url,
          retrievedAt: now,
          confidence: 0.9, // authoritative for affiliation/title/homepage
          rawExcerpt: f.title,
        },
      ],
    }));
  }
}
