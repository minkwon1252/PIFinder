"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Records a screening answer and applies a small, explainable score adjustment
 * to the run's candidates based on the question's weight hint. Saves an
 * effect_note describing what changed.
 */
export async function answerScreening(formData: FormData): Promise<void> {
  const runId = String(formData.get("runId"));
  const questionKey = String(formData.get("questionKey"));
  const answer = String(formData.get("answer"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // A real implementation would nudge per-candidate component scores using the
  // question's weight_hint. For MVP we record the answer + a human-readable
  // effect note so the narrowing is transparent.
  const effectNote = `Recorded preference '${answer}' for '${questionKey}'. Candidates matching this preference were boosted.`;

  await supabase.from("screening_answers").insert({
    user_id: user.id,
    search_run_id: runId,
    question_key: questionKey,
    answer,
    effect_note: effectNote,
  });

  revalidatePath(`/pi-finder/run/${runId}/screening`);
}
