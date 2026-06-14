"use server";

import { createClient } from "@/lib/supabase/server";

export async function saveTypingAttempt(input: {
  wpm: number;
  accuracy: number;
  durationSeconds: number;
  sampleText: string;
}): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  await supabase.from("typing_practice_attempts").insert({
    user_id: user.id,
    wpm: input.wpm,
    accuracy: input.accuracy,
    duration_seconds: input.durationSeconds,
    sample_text: input.sampleText,
  });
  return { ok: true };
}
