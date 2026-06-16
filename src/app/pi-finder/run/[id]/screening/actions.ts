"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Records a screening answer (up to two ranked preferences) and applies a small,
 * explainable re-rank: candidates whose research themes/identity match a chosen
 * preference get a score boost (Preference 1 weighted more than Preference 2),
 * so the refined ranking visibly changes back on the results page.
 */
export async function answerScreening(formData: FormData): Promise<void> {
  const runId = String(formData.get("runId") ?? "");
  const questionKey = String(formData.get("questionKey") ?? "");
  const pref1 = String(formData.get("pref1") ?? "").trim();
  const pref2 = String(formData.get("pref2") ?? "").trim();
  const prefs = [pref1, pref2].filter(Boolean);
  if (!runId || prefs.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Apply a transparent boost to matching candidates in this run.
  const { data: cands } = await supabase
    .from("candidate_professors")
    .select("id, total_score, professors(research_themes, research_identity)")
    .eq("search_run_id", runId)
    .eq("user_id", user.id);

  let boosted = 0;
  for (const c of cands ?? []) {
    const prof = (c as any).professors;
    const themes: string[] = (Array.isArray(prof) ? prof[0]?.research_themes : prof?.research_themes) ?? [];
    const identity: string = (Array.isArray(prof) ? prof[0]?.research_identity : prof?.research_identity) ?? "";
    const hay = `${themes.join(" ")} ${identity}`.toLowerCase();
    let delta = 0;
    if (pref1 && hay.includes(pref1.toLowerCase())) delta += 3;
    if (pref2 && hay.includes(pref2.toLowerCase())) delta += 1.5;
    if (delta > 0) {
      await supabase
        .from("candidate_professors")
        .update({ total_score: Number((c as any).total_score) + delta })
        .eq("id", (c as any).id);
      boosted++;
    }
  }

  const answer = prefs.map((p, i) => `${p} (${i === 0 ? "1st" : "2nd"})`).join(", ");
  const effectNote =
    boosted > 0
      ? `Recorded ${answer}. ${boosted} candidate${boosted === 1 ? "" : "s"} matching your preference were boosted in the ranking.`
      : `Recorded ${answer}. No candidate had a direct keyword match this round, so the ranking was unchanged.`;

  await supabase.from("screening_answers").insert({
    user_id: user.id,
    search_run_id: runId,
    question_key: questionKey,
    answer,
    effect_note: effectNote,
  });

  revalidatePath(`/pi-finder/run/${runId}/screening`);
  revalidatePath(`/pi-finder/run/${runId}`);
}
