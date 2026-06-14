/**
 * Explainable fit-scoring model.
 *
 * We store each component, not just the total, so the UI can explain WHY a
 * professor ranks where they do. All component functions return 0..1; weights
 * sum to 1 before the risk penalty is subtracted.
 */

export interface ScoreInput {
  /** Student research keywords, lowercased. */
  studentKeywords: string[];
  /** Professor research themes, lowercased. */
  professorThemes: string[];
  /** 'experimental' | 'computational' | 'theoretical' | 'mixed' | 'unknown'. */
  studentMethod: string;
  professorMethod?: string | null;
  /** Free-text application area from the profile. */
  applicationArea?: string | null;
  /** Most recent publication year, if known. */
  latestPublicationYear?: number | null;
  /** Keywords extracted from the student's CV/projects, lowercased. */
  projectKeywords: string[];
  /** Whether prof's dept/school matches a student target. */
  deptSchoolMatch: boolean;
  /** Proxy 0..1 for lab activity (e.g. recent works count, normalized). */
  labActivity?: number | null;
  /** Proxy 0..1 for mentorship accessibility (e.g. rising vs. mega-lab). */
  mentorshipProxy?: number | null;
  /** Data completeness 0..1 (drives the stale/incomplete risk penalty). */
  dataCompleteness?: number | null;
}

export interface ScoreComponents {
  keyword_fit: number;
  method_fit: number;
  application_domain_fit: number;
  publication_recency: number;
  project_overlap: number;
  dept_school_match: number;
  lab_activity: number;
  mentorship_proxy: number;
  risk_penalty: number;
}

export interface ScoreResult {
  total: number; // 0..100
  components: ScoreComponents;
  explanation: Record<string, string>;
}

export const WEIGHTS = {
  keyword_fit: 0.26,
  method_fit: 0.14,
  application_domain_fit: 0.14,
  publication_recency: 0.1,
  project_overlap: 0.18,
  dept_school_match: 0.08,
  lab_activity: 0.05,
  mentorship_proxy: 0.05,
} as const;

function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a.map((s) => s.toLowerCase().trim()).filter(Boolean));
  const sb = new Set(b.map((s) => s.toLowerCase().trim()).filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : inter / union;
}

function methodFit(student: string, professor?: string | null): number {
  if (!professor || professor === "unknown" || student === "unknown") return 0.5;
  if (student === "mixed" || professor === "mixed") return 0.75;
  return student === professor ? 1 : 0.25;
}

function recencyScore(year?: number | null): number {
  if (!year) return 0.3; // unknown → modest, not zero
  const age = new Date().getFullYear() - year;
  if (age <= 1) return 1;
  if (age <= 3) return 0.8;
  if (age <= 5) return 0.5;
  if (age <= 8) return 0.3;
  return 0.1;
}

function domainFit(area: string | null | undefined, themes: string[]): number {
  if (!area) return 0.5;
  const a = area.toLowerCase();
  const hit = themes.some((t) => a.includes(t.toLowerCase()) || t.toLowerCase().includes(a));
  return hit ? 1 : 0.4;
}

export function scoreFit(input: ScoreInput): ScoreResult {
  const keyword_fit = jaccard(input.studentKeywords, input.professorThemes);
  const method_fit = methodFit(input.studentMethod, input.professorMethod);
  const application_domain_fit = domainFit(input.applicationArea, input.professorThemes);
  const publication_recency = recencyScore(input.latestPublicationYear);
  const project_overlap = jaccard(input.projectKeywords, input.professorThemes);
  const dept_school_match = input.deptSchoolMatch ? 1 : 0;
  const lab_activity = clamp01(input.labActivity ?? 0.5);
  const mentorship_proxy = clamp01(input.mentorshipProxy ?? 0.5);

  // Risk penalty grows as data completeness drops. Up to 0.2 off the total.
  const completeness = clamp01(input.dataCompleteness ?? 0.5);
  const risk_penalty = (1 - completeness) * 0.2;

  const weighted =
    keyword_fit * WEIGHTS.keyword_fit +
    method_fit * WEIGHTS.method_fit +
    application_domain_fit * WEIGHTS.application_domain_fit +
    publication_recency * WEIGHTS.publication_recency +
    project_overlap * WEIGHTS.project_overlap +
    dept_school_match * WEIGHTS.dept_school_match +
    lab_activity * WEIGHTS.lab_activity +
    mentorship_proxy * WEIGHTS.mentorship_proxy;

  const total = Math.round(clamp01(weighted - risk_penalty) * 1000) / 10; // 0..100, 1 dp

  return {
    total,
    components: {
      keyword_fit,
      method_fit,
      application_domain_fit,
      publication_recency,
      project_overlap,
      dept_school_match,
      lab_activity,
      mentorship_proxy,
      risk_penalty,
    },
    explanation: {
      keyword_fit: `Overlap between your keywords and the professor's research themes (${pct(keyword_fit)}).`,
      method_fit: `Match between your preferred research method and the lab's style (${pct(method_fit)}).`,
      application_domain_fit: `Alignment of your application area with the lab's themes (${pct(application_domain_fit)}).`,
      publication_recency: `How recently the lab has published (${pct(publication_recency)}).`,
      project_overlap: `Overlap between your CV/projects and the lab's work (${pct(project_overlap)}).`,
      dept_school_match: input.deptSchoolMatch
        ? "Professor is in one of your target school/department combinations."
        : "Professor is outside your explicitly targeted departments.",
      risk_penalty:
        risk_penalty > 0.05
          ? `Score reduced by ${pct(risk_penalty)} due to incomplete/stale source data.`
          : "Source data is reasonably complete.",
    },
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
