import type { Tier } from "@/lib/department-expansion";

/** The persistent Research Profile reused in every agent run. */
export interface ResearchProfile {
  userId: string;
  majors: string[]; // department abbreviations; [0] is primary
  targetDegree: "MS" | "PhD" | "MS_PhD" | "undecided";
  interests: string[]; // research keywords (lowercased)
  methodPreference:
    | "experimental"
    | "computational"
    | "theoretical"
    | "mixed"
    | "unknown";
  applicationArea?: string | null;
  projectSummary?: string | null;
  projectKeywords: string[];
  targetSchools: { schoolName: string; tier: Tier }[];
}

/** Evidence classification, surfaced honestly in the UI. */
export type EvidenceKind =
  | "verified_fact"
  | "inferred_fit"
  | "user_provided"
  | "missing_uncertain";

export interface EvidenceItem {
  kind: EvidenceKind;
  statement: string;
  sourceUrl?: string;
  confidence?: number;
}
