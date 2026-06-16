import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadResearchProfile } from "@/lib/profile";
import { getLlm } from "@/lib/llm/provider";
import { checkMonthlyQuota, logLlmUsage } from "@/lib/llm/usage";
import { AGENT_ROLES } from "@/lib/agents/roles";

/**
 * Story generation — Issue 4.
 *
 * Flow: browser → THIS backend route → LLM provider → backend → browser.
 * The provider API key lives only in server env (never in the browser). The
 * route is auth-required, validates input, enforces a per-user monthly quota,
 * logs usage, and grounds output only in the student's real profile/CV.
 */
const bodySchema = z.object({ candidateId: z.string().uuid() });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid candidateId is required." }, { status: 400 });
  }
  const { candidateId } = parsed.data;

  // Per-user monthly quota.
  const quota = await checkMonthlyQuota(user.id, "story_generation");
  if (!quota.allowed) {
    return NextResponse.json(
      { error: `Monthly story limit reached (${quota.used}/${quota.limit}). Try again next month.` },
      { status: 429 },
    );
  }

  // Candidate must belong to the user (RLS on candidate_professors enforces ownership).
  const { data: cand } = await supabase
    .from("candidate_professors")
    .select("id, professors(full_name, research_identity, research_themes), schools(name), departments(name)")
    .eq("id", candidateId)
    .maybeSingle();
  if (!cand) {
    return NextResponse.json({ error: "Professor not found in your runs." }, { status: 404 });
  }

  const profile = await loadResearchProfile(user.id);
  const llm = getLlm();
  const prompt = `Student profile: ${JSON.stringify(profile)}\n\nProfessor: ${JSON.stringify(
    cand,
  )}\n\nWrite an honest SOP story angle. Do NOT invent experience, publications, awards, or connections. Output sections: SOP angle, School reason, Department reason, CV connection, Email talking points.`;

  let result;
  try {
    result = await llm.complete([
      { role: "system", content: AGENT_ROLES.story_coach.systemPrompt },
      { role: "user", content: prompt },
    ]);
  } catch (e) {
    await logLlmUsage({
      userId: user.id,
      feature: "story_generation",
      provider: llm.id,
      model: llm.model,
      success: false,
      errorType: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    });
    console.error("[story/generate] LLM call failed:", e);
    return NextResponse.json(
      { error: "Story generation failed. Please try again shortly." },
      { status: 502 },
    );
  }

  await logLlmUsage({
    userId: user.id,
    feature: "story_generation",
    provider: llm.id,
    model: llm.model,
    usage: result.usage,
    success: true,
  });

  const { error: upErr } = await supabase.from("story_plans").upsert(
    {
      user_id: user.id,
      candidate_id: candidateId,
      sop_angle: result.text,
      school_reason: (cand as any)?.schools?.name ?? null,
      department_reason: (cand as any)?.departments?.name ?? null,
    },
    { onConflict: "user_id,candidate_id" },
  );
  if (upErr) {
    return NextResponse.json({ error: "Saved usage but failed to store the story." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sopAngle: result.text, provider: llm.id });
}
