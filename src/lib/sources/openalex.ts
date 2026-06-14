import { serverEnv } from "@/lib/env";
import type {
  ProfessorRecord,
  ProfessorSearchQuery,
  ProfessorSourceAdapter,
} from "./types";

/**
 * OpenAlex adapter (Phase 3). OpenAlex has no auth but asks for a contact email
 * (the "polite pool"). This implementation queries authors by concept/keyword.
 *
 * NOTE: OpenAlex is institution + author centric, not department centric, so
 * department attribution is best-effort and stored with modest confidence.
 * Network calls are intentionally guarded so MVP works offline.
 */
export class OpenAlexAdapter implements ProfessorSourceAdapter {
  readonly id = "openalex";
  private readonly base = "https://api.openalex.org";

  async search(query: ProfessorSearchQuery): Promise<ProfessorRecord[]> {
    const { openalexMailto } = serverEnv();
    const params = new URLSearchParams({
      search: query.keywords.join(" "),
      per_page: String(query.limit ?? 10),
    });
    if (openalexMailto) params.set("mailto", openalexMailto);

    let json: any;
    try {
      const res = await fetch(`${this.base}/authors?${params.toString()}`, {
        headers: { Accept: "application/json" },
        // Cache for an hour to respect rate limits.
        next: { revalidate: 3600 },
      });
      if (!res.ok) return [];
      json = await res.json();
    } catch {
      // Offline / network failure → return nothing rather than throwing.
      return [];
    }

    const now = new Date().toISOString();
    return (json.results ?? []).map((a: any): ProfessorRecord => ({
      fullName: a.display_name,
      openalexId: a.id,
      orcid: a.orcid ?? undefined,
      researchThemes: (a.x_concepts ?? [])
        .slice(0, 6)
        .map((c: any) => String(c.display_name).toLowerCase()),
      schoolName: query.schoolName,
      departmentAbbrev: query.departmentAbbrev,
      metrics: {
        citationCount: a.cited_by_count,
        hIndex: a.summary_stats?.h_index,
        worksCount: a.works_count,
      },
      sources: [
        {
          sourceType: "openalex",
          sourceUrl: a.id,
          retrievedAt: now,
          confidence: 0.7,
        },
      ],
    }));
  }
}
