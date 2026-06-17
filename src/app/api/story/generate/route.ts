import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadResearchProfile } from "@/lib/profile";
import { getLlm, availableProviders } from "@/lib/llm/provider";
import { checkMonthlyQuota, logLlmUsage } from "@/lib/llm/usage";
import { loadUserStoryDocs } from "@/lib/documents";
import { AGENT_ROLES } from "@/lib/agents/roles";

// PDF parsing (unpdf) + the admin client need the Node.js runtime.
export const runtime = "nodejs";
// Allow time for provider retries on transient "high demand" (429/503) spikes.
export const maxDuration = 60;

/**
 * Story generation — Issue 4.
 *
 * Flow: browser → THIS backend route → LLM provider → backend → browser.
 * The provider API key lives only in server env (never in the browser). The
 * client may pass a `provider` id (e.g. "openai" | "gemini") to choose among
 * the configured providers; the backend supplies the matching key. The route is
 * auth-required, validates input, enforces a per-user monthly quota, logs usage,
 * and grounds output only in the student's real profile/CV.
 */
const bodySchema = z.object({
  candidateId: z.string().uuid(),
  provider: z.enum(["anthropic", "openai", "gemini"]).optional(),
});

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
  const { candidateId, provider } = parsed.data;
  // Only honor a requested provider if it's actually configured server-side.
  const configured = availableProviders().map((p) => p.id);
  const chosenProvider = provider && configured.includes(provider) ? provider : undefined;

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
  const docs = await loadUserStoryDocs(user.id); // CV + optional story file text
  const docBlock = docs.length
    ? docs.map((d) => `--- ${d.label} ---\n${d.text}`).join("\n\n")
    : "(No CV/story file uploaded — rely on the structured profile only.)";

  const llm = getLlm(chosenProvider);
  const prompt = [
    "Write an honest, specific application story connecting THIS student to THIS professor's lab.",
    "Ground EVERY claim ONLY in the student's real documents and profile below (their actual CV and",
    "'story' file are the primary evidence). Do NOT invent experience, publications, awards, skills,",
    "or personal connections. If the student's background is thin for something, say so plainly.",
    "",
    "STUDENT DOCUMENTS (verbatim text from their uploaded CV / story file — primary evidence):",
    docBlock,
    "",
    `STUDENT STRUCTURED PROFILE (goals, interests, targets): ${JSON.stringify(profile)}`,
    "",
    `PROFESSOR / LAB (research identity + themes): ${JSON.stringify(cand)}`,
    "",
    "Output these sections with these exact headings:",
    "1. Fit thesis — one short paragraph on how the student's goals align with the lab's research aims.",
    "2. Dream ↔ lab focus — concretely connect what the student wants to do (their interests/application area/project summary) to the professor's specific research themes.",
    "3. How you can contribute — based ONLY on the student's real skills and projects, what could they realistically bring to the lab's projects? Be honest about gaps.",
    "4. SOP angle — a draft paragraph for the statement of purpose.",
    "5. Email talking points — 3 short bullets for a first email to this professor.",
  ].join("\n");

  let result;
  try {
    result = await llm.complete(
      [
        { role: "system", content: AGENT_ROLES.story_coach.systemPrompt },
        { role: "user", content: prompt },
      ],
      { maxTokens: 1500 },
    );
  } catch (e) {
    const raw = e instanceof Error ? e.message : "unknown error";
    await logLlmUsage({
      userId: user.id,
      feature: "story_generation",
      provider: llm.id,
      model: llm.model,
      success: false,
      errorType: raw.slice(0, 200),
    });
    console.error("[story/generate] LLM call failed:", raw);
    // Sanitize: strip anything that looks like a bearer/key, cap length. Provider
    // error reasons (bad key / model not found / quota) are safe to surface and
    // help the user fix configuration.
    const detail = raw
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer ***")
      .replace(/(key|token)["':=\s]+[A-Za-z0-9._-]{12,}/gi, "$1 ***")
      .slice(0, 400);
    return NextResponse.json(
      {
        error: `Story generation failed via ${llm.id} (${llm.model}). Check the provider key/model in Vercel.`,
        detail,
      },
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
