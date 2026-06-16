"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Set (or clear) a candidate's preference rank within a run — Issue 3.
 *   rank 1 = Preference 1 (blue), rank 2 = Preference 2 (green), 0 = clear.
 * Enforces at most one Preference 1 and one Preference 2 per run by clearing the
 * rank from any other candidate first. Owner-only (RLS + user_id filter).
 */
export async function setPreference(formData: FormData): Promise<void> {
  const candidateId = String(formData.get("candidateId") ?? "");
  const runId = String(formData.get("runId") ?? "");
  const rank = Number(formData.get("rank") ?? 0);
  if (!candidateId || !runId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  if (rank === 1 || rank === 2) {
    // Only one candidate may hold each rank in a run.
    await supabase
      .from("candidate_professors")
      .update({ preference_rank: null })
      .eq("search_run_id", runId)
      .eq("user_id", user.id)
      .eq("preference_rank", rank);
    await supabase
      .from("candidate_professors")
      .update({ preference_rank: rank })
      .eq("id", candidateId)
      .eq("user_id", user.id);
  } else {
    await supabase
      .from("candidate_professors")
      .update({ preference_rank: null })
      .eq("id", candidateId)
      .eq("user_id", user.id);
  }
  revalidatePath(`/pi-finder/run/${runId}`);
}
