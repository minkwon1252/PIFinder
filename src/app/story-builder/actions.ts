"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadResearchProfile } from "@/lib/profile";
import { getLlm } from "@/lib/llm/provider";
import { AGENT_ROLES } from "@/lib/agents/roles";

/**
 * Story Coach: generates an honest, professor-specific SOP angle grounded ONLY
 * in the student's real profile/CV. Persists a story_plan row.
 */
export async function generateStory(formData: FormData): Promise<void> {
  const candidateId = String(formData.get("candidateId"));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const profile = await loadResearchProfile(user.id);

  const { data: cand } = await supabase
    .from("candidate_professors")
    .select("professors(full_name, research_identity, research_themes), schools(name), departments(name)")
    .eq("id", candidateId)
    .maybeSingle();

  const llm = getLlm();
  const prompt = `Student profile: ${JSON.stringify(profile)}\n\nProfessor: ${JSON.stringify(
    cand,
  )}\n\nWrite an honest SOP story angle. Do NOT invent experience, publications, awards, or connections. Output sections: SOP angle, School reason, Department reason, CV connection, Email talking points.`;

  const text = await llm.complete([
    { role: "system", content: AGENT_ROLES.story_coach.systemPrompt },
    { role: "user", content: prompt },
  ]);

  await supabase.from("story_plans").upsert(
    {
      user_id: user.id,
      candidate_id: candidateId,
      sop_angle: text,
      school_reason: (cand as any)?.schools?.name ?? null,
      department_reason: (cand as any)?.departments?.name ?? null,
    },
    { onConflict: "user_id,candidate_id" },
  );

  revalidatePath("/story-builder");
}
