import { serverEnv } from "@/lib/env";
import type {
  ProfessorRecord,
  ProfessorSearchQuery,
  ProfessorSourceAdapter,
} from "./types";

/**
 * Semantic Scholar adapter (Phase 3). Optional API key raises rate limits.
 * We DO NOT scrape Google Scholar — Semantic Scholar's official Graph API is
 * the supported metrics source alongside OpenAlex.
 */
export class SemanticScholarAdapter implements ProfessorSourceAdapter {
  readonly id = "semantic_scholar";
  private readonly base = "https://api.semanticscholar.org/graph/v1";

  async search(query: ProfessorSearchQuery): Promise<ProfessorRecord[]> {
    const { semanticScholarApiKey } = serverEnv();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (semanticScholarApiKey) headers["x-api-key"] = semanticScholarApiKey;

    const params = new URLSearchParams({
      query: query.keywords.join(" "),
      fields: "name,hIndex,citationCount,paperCount,affiliations",
      limit: String(query.limit ?? 10),
    });

    let json: any;
    try {
      const res = await fetch(`${this.base}/author/search?${params.toString()}`, {
        headers,
        next: { revalidate: 3600 },
      });
      if (!res.ok) return [];
      json = await res.json();
    } catch {
      return [];
    }

    const now = new Date().toISOString();
    return (json.data ?? []).map((a: any): ProfessorRecord => ({
      fullName: a.name,
      semanticScholarId: a.authorId,
      researchThemes: query.keywords,
      schoolName: query.schoolName,
      departmentAbbrev: query.departmentAbbrev,
      metrics: {
        citationCount: a.citationCount,
        hIndex: a.hIndex,
        worksCount: a.paperCount,
      },
      sources: [
        {
          sourceType: "semantic_scholar",
          sourceUrl: `https://www.semanticscholar.org/author/${a.authorId}`,
          retrievedAt: now,
          confidence: 0.65,
        },
      ],
    }));
  }
}
