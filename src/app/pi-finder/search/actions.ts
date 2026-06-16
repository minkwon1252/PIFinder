"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Mode C — save a manually-found professor to the shortlist.
 * Shortlists reference candidate_professors (which belong to a run), so we
 * get-or-create a per-user "Manual saves" run (mode = manual_search) and a
 * candidate row for the professor, then upsert the shortlist entry. All writes
 * go through the RLS client and are scoped to the authenticated user.
 */
export async function saveManualCandidate(formData: FormData): Promise<void> {
  const professorId = String(formData.get("professorId") ?? "");
  if (!professorId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // 1) get-or-create the manual-saves run
  let runId: string | null = null;
  const { data: existingRun } = await supabase
    .from("search_runs")
    .select("id")
    .eq("user_id", user.id)
    .eq("mode", "manual_search")
    .maybeSingle();
  runId = existingRun?.id ?? null;
  if (!runId) {
    const { data: created } = await supabase
      .from("search_runs")
      .insert({
        user_id: user.id,
        mode: "manual_search",
        status: "complete",
        nickname: "Manual saves",
        params: { manual: true },
      })
      .select("id")
      .single();
    runId = created?.id ?? null;
  }
  if (!runId) return;

  // 2) resolve a primary affiliation (school/department) for the candidate row
  const { data: aff } = await supabase
    .from("professor_affiliations")
    .select("school_id, department_id")
    .eq("professor_id", professorId)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 3) get-or-create the candidate row for (run, professor)
  let candidateId: string | null = null;
  const { data: existingCand } = await supabase
    .from("candidate_professors")
    .select("id")
    .eq("search_run_id", runId)
    .eq("professor_id", professorId)
    .maybeSingle();
  candidateId = existingCand?.id ?? null;
  if (!candidateId) {
    const { data: createdCand } = await supabase
      .from("candidate_professors")
      .insert({
        user_id: user.id,
        search_run_id: runId,
        professor_id: professorId,
        school_id: aff?.school_id ?? null,
        department_id: aff?.department_id ?? null,
        total_score: 0,
        fit_reason: "Added via manual database search.",
      })
      .select("id")
      .single();
    candidateId = createdCand?.id ?? null;
  }
  if (!candidateId) return;

  // 4) add to shortlist (idempotent)
  await supabase
    .from("shortlists")
    .upsert({ user_id: user.id, candidate_id: candidateId }, { onConflict: "user_id,candidate_id" });

  revalidatePath("/pi-finder/search");
  revalidatePath("/shortlist");
}
