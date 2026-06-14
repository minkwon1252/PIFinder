import type {
  ProfessorRecord,
  ProfessorSearchQuery,
  ProfessorSourceAdapter,
} from "./types";

/**
 * Official department/lab/admissions page adapter (Phase 3).
 *
 * This is the source of record for affiliation + lab membership. In production
 * this would fetch the school_departments.faculty_url, parse the faculty roster
 * (respecting robots.txt), and emit a source record per professor. It is left
 * as an interface-complete stub for MVP — wiring a real fetch/parse here is a
 * Phase 3 task and must store source_url + retrieved_at + confidence.
 */
export class OfficialPageAdapter implements ProfessorSourceAdapter {
  readonly id = "official_page";

  async search(_query: ProfessorSearchQuery): Promise<ProfessorRecord[]> {
    // Intentionally returns nothing until a compliant fetch/parse is wired in.
    // Returning [] (not throwing) keeps the pipeline graceful.
    return [];
  }
}
