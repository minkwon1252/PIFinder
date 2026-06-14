import type {
  ProfessorRecord,
  ProfessorSearchQuery,
  ProfessorSourceAdapter,
} from "./types";

/**
 * MockAdapter — returns clearly-synthetic professors for Phase 2 pipeline
 * development. All records are marked [SAMPLE] and carry low confidence so they
 * are never mistaken for verified data.
 */
export class MockAdapter implements ProfessorSourceAdapter {
  readonly id = "mock";

  async search(query: ProfessorSearchQuery): Promise<ProfessorRecord[]> {
    const now = new Date().toISOString();
    const base = `${query.schoolName} ${query.departmentAbbrev}`;
    const themes = query.keywords.length ? query.keywords : ["materials"];

    return [1, 2, 3].map((n) => ({
      fullName: `[SAMPLE] ${base} Prof ${String.fromCharCode(64 + n)}`,
      researchIdentity: `Synthetic ${query.departmentAbbrev} researcher focused on ${themes.join(", ")}.`,
      researchThemes: themes,
      schoolName: query.schoolName,
      departmentAbbrev: query.departmentAbbrev,
      title: n === 3 ? "Assistant Professor" : "Professor",
      metrics: { citationCount: 5000 * n, hIndex: 20 + n * 5, worksCount: 50 * n },
      recentPapers: [
        {
          title: `[SAMPLE] Recent advances in ${themes[0]}`,
          year: new Date().getFullYear() - n,
          venue: "Synthetic Journal",
        },
      ],
      sources: [
        {
          sourceType: "department_page",
          sourceUrl: `https://example.edu/${query.departmentAbbrev.toLowerCase()}/people`,
          retrievedAt: now,
          confidence: 0.3,
          rawExcerpt: "SAMPLE record — not real data.",
        },
      ],
    }));
  }
}
