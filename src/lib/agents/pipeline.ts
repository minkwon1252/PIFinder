import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { expandDepartments, type Tier } from "@/lib/department-expansion";
import { scoreFit } from "@/lib/scoring/fit";
import { audit } from "@/lib/audit";
import type { ResearchProfile } from "./types";

/**
 * PI Finder pipeline (Phase 2, MVP).
 *
 * Orchestrates the agent roles deterministically over SEEDED professor data:
 *   School Mapper  → expand departments per tier
 *   Professor Scout → match seeded professors in those schools/departments
 *   Fit Ranker     → score with the explainable model, persist components
 *
 * Produces candidate_professors + candidate_scores rows for the search_run.
 * Real source adapters (OpenAlex/Semantic Scholar/official pages) replace the
 * seeded lookup in Phase 3 behind the same interface.
 */
export async function runPiFinder(params: {
  userId: string;
  searchRunId: string;
  mode: "department_list" | "ultimate_match";
  profile: ResearchProfile;
}): Promise<{ candidateCount: number }> {
  const admin = createAdminClient();
  const { profile } = params;

  // Load reference data once.
  const { data: schools } = await admin.from("schools").select("id, name, short_name");
  const { data: depts } = await admin.from("departments").select("id, abbrev");
  const deptByAbbrev = new Map((depts ?? []).map((d) => [d.abbrev, d.id]));

  const candidatesToInsert: any[] = [];

  for (const target of profile.targetSchools) {
    const school = (schools ?? []).find(
      (s) => s.name === target.schoolName || s.short_name === target.schoolName,
    );
    if (!school) continue;

    const wantedDeptAbbrevs = expandDepartments({
      majorAbbrev: profile.majors[0] ?? "MSE",
      secondMajorAbbrev: profile.majors[1] ?? null,
      keywords: profile.interests,
      tier: target.tier as Tier,
    });
    const wantedDeptIds = wantedDeptAbbrevs
      .map((a) => deptByAbbrev.get(a))
      .filter(Boolean);

    // Professor Scout: seeded professors affiliated with this school + dept set.
    const { data: affils } = await admin
      .from("professor_affiliations")
      .select(
        "professor_id, school_id, department_id, professors(id, full_name, research_themes), professor_sources:professors!inner(id)",
      )
      .eq("school_id", school.id);

    const { data: profRows } = await admin
      .from("professors")
      .select("id, full_name, research_themes");
    const profById = new Map((profRows ?? []).map((p) => [p.id, p]));

    for (const a of affils ?? []) {
      if (a.department_id && wantedDeptIds.length && !wantedDeptIds.includes(a.department_id)) {
        continue;
      }
      const prof = profById.get(a.professor_id);
      if (!prof) continue;

      // Source completeness → drives the risk penalty.
      const { data: sources } = await admin
        .from("professor_sources")
        .select("confidence")
        .eq("professor_id", prof.id);
      const avgConf =
        (sources ?? []).reduce((s, r) => s + Number(r.confidence), 0) /
        Math.max(1, (sources ?? []).length);

      const { data: metrics } = await admin
        .from("professor_metrics")
        .select("works_count")
        .eq("professor_id", prof.id)
        .maybeSingle();

      const score = scoreFit({
        studentKeywords: profile.interests,
        professorThemes: prof.research_themes ?? [],
        studentMethod: profile.methodPreference,
        professorMethod: null,
        applicationArea: profile.applicationArea,
        latestPublicationYear: null,
        projectKeywords: profile.projectKeywords,
        deptSchoolMatch: true,
        labActivity: metrics?.works_count ? Math.min(1, metrics.works_count / 200) : 0.5,
        mentorshipProxy: 0.5,
        dataCompleteness: avgConf,
      });

      candidatesToInsert.push({
        userId: params.userId,
        searchRunId: params.searchRunId,
        professorId: prof.id,
        schoolId: school.id,
        departmentId: a.department_id ?? null,
        score,
      });
    }
  }

  // Rank within (school) and persist.
  candidatesToInsert.sort((a, b) => b.score.total - a.score.total);

  let inserted = 0;
  const bySchool = new Map<string, number>();
  for (const c of candidatesToInsert) {
    const seen = bySchool.get(c.schoolId) ?? 0;
    // Mode A keeps up to 3 per school/dept; Mode B keeps 1 per school.
    const cap = params.mode === "ultimate_match" ? 1 : 3;
    if (seen >= cap) continue;
    bySchool.set(c.schoolId, seen + 1);

    const { data: cand, error } = await admin
      .from("candidate_professors")
      .insert({
        user_id: c.userId,
        search_run_id: c.searchRunId,
        professor_id: c.professorId,
        school_id: c.schoolId,
        department_id: c.departmentId,
        total_score: c.score.total,
        rank: seen + 1,
        is_ultimate_match: params.mode === "ultimate_match",
        fit_reason: Object.values(c.score.explanation).join(" "),
        mismatch_risk:
          c.score.components.risk_penalty > 0.05
            ? "Some source data is incomplete or stale; verify before contacting."
            : null,
      })
      .select("id")
      .single();

    if (error || !cand) continue;

    await admin.from("candidate_scores").insert({
      user_id: c.userId,
      candidate_id: cand.id,
      keyword_fit: c.score.components.keyword_fit,
      method_fit: c.score.components.method_fit,
      application_domain_fit: c.score.components.application_domain_fit,
      publication_recency: c.score.components.publication_recency,
      project_overlap: c.score.components.project_overlap,
      dept_school_match: c.score.components.dept_school_match,
      lab_activity: c.score.components.lab_activity,
      mentorship_proxy: c.score.components.mentorship_proxy,
      risk_penalty: c.score.components.risk_penalty,
      explanation: c.score.explanation,
    });
    inserted++;
  }

  await admin
    .from("search_runs")
    .update({ status: "complete", completed_at: new Date().toISOString() })
    .eq("id", params.searchRunId);

  await audit({
    actorId: params.userId,
    action: "search_run.complete",
    entity: "search_runs",
    entityId: params.searchRunId,
    metadata: { mode: params.mode, candidateCount: inserted },
  });

  return { candidateCount: inserted };
}
