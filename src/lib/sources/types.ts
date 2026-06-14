/**
 * Source adapter interfaces. Every professor claim PIFinder shows must be
 * traceable to a SourceRecord (source_type + url + retrieved_at + confidence).
 *
 * MVP implements the MockAdapter; Phase 3 adds OpenAlex / Semantic Scholar /
 * official-page adapters behind the same interface.
 */

export type SourceType =
  | "department_page"
  | "lab_page"
  | "admissions"
  | "openalex"
  | "semantic_scholar"
  | "crossref"
  | "orcid";

export interface SourceRecord {
  sourceType: SourceType;
  sourceUrl?: string;
  retrievedAt: string; // ISO timestamp
  confidence: number; // 0..1
  rawExcerpt?: string;
}

export interface PaperRecord {
  title: string;
  doi?: string;
  openalexId?: string;
  year?: number;
  venue?: string;
  citationCount?: number;
  url?: string;
}

export interface MetricsRecord {
  citationCount?: number;
  hIndex?: number;
  worksCount?: number;
}

export interface ProfessorRecord {
  fullName: string;
  researchIdentity?: string;
  homepageUrl?: string;
  labName?: string;
  labUrl?: string;
  openalexId?: string;
  orcid?: string;
  semanticScholarId?: string;
  researchThemes: string[];
  schoolName?: string;
  departmentAbbrev?: string;
  title?: string;
  metrics?: MetricsRecord;
  recentPapers?: PaperRecord[];
  influentialPapers?: PaperRecord[];
  /** Every record carries its provenance. */
  sources: SourceRecord[];
}

export interface ProfessorSearchQuery {
  schoolName: string;
  departmentAbbrev: string;
  keywords: string[];
  limit?: number;
}

/** Common interface for all professor data sources. */
export interface ProfessorSourceAdapter {
  readonly id: string;
  /** Discover candidate professors for a school+department+keywords query. */
  search(query: ProfessorSearchQuery): Promise<ProfessorRecord[]>;
  /** Enrich a known professor (metrics, papers) — optional for some adapters. */
  enrich?(professor: ProfessorRecord): Promise<ProfessorRecord>;
}
