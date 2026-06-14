"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reviveScore } from "@/lib/freshness";

async function uid() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function addToShortlist(formData: FormData): Promise<void> {
  const candidateId = String(formData.get("candidateId"));
  const { supabase, user } = await uid();
  if (!user) return;
  await supabase
    .from("shortlists")
    .upsert({ user_id: user.id, candidate_id: candidateId }, { onConflict: "user_id,candidate_id" });
  // Saving un-eliminates.
  await supabase.from("eliminated_candidates").delete().eq("candidate_id", candidateId);
  revalidatePath("/shortlist");
}

export async function removeFromShortlist(formData: FormData): Promise<void> {
  const candidateId = String(formData.get("candidateId"));
  const { supabase, user } = await uid();
  if (!user) return;
  await supabase
    .from("shortlists")
    .delete()
    .eq("user_id", user.id)
    .eq("candidate_id", candidateId);
  revalidatePath("/shortlist");
}

export async function eliminateCandidate(formData: FormData): Promise<void> {
  const candidateId = String(formData.get("candidateId"));
  const reason = String(formData.get("reason") ?? "");
  const { supabase, user } = await uid();
  if (!user) return;
  await supabase
    .from("eliminated_candidates")
    .upsert({ user_id: user.id, candidate_id: candidateId, reason }, { onConflict: "candidate_id" });
  await supabase
    .from("shortlists")
    .delete()
    .eq("user_id", user.id)
    .eq("candidate_id", candidateId);
  revalidatePath("/shortlist");
}

/**
 * Revive flow: records the new info that makes the professor relevant again,
 * re-runs scoring (here: a simple boost to reflect the new evidence), and
 * records old/new rank for the explanation.
 */
export async function reviveCandidate(formData: FormData): Promise<void> {
  const candidateId = String(formData.get("candidateId"));
  const newInfo = String(formData.get("newInfo") ?? "").trim();
  if (!newInfo) return;
  const { supabase, user } = await uid();
  if (!user) return;

  const { data: cand } = await supabase
    .from("candidate_professors")
    .select("rank, total_score")
    .eq("id", candidateId)
    .maybeSingle();

  const oldRank = cand?.rank ?? null;

  // Re-score: new evidence raises the score modestly (capped at 100).
  const newScore = reviveScore(Number(cand?.total_score ?? 0));
  await supabase
    .from("candidate_professors")
    .update({ total_score: newScore })
    .eq("id", candidateId);

  await supabase.from("eliminated_candidates").delete().eq("candidate_id", candidateId);
  await supabase.from("revived_candidates").insert({
    user_id: user.id,
    candidate_id: candidateId,
    new_info: newInfo,
    old_rank: oldRank,
    new_rank: oldRank, // recomputed on next full run
  });
  revalidatePath("/shortlist");
}
