"use server";

import { createClient } from "@/lib/supabase/server";
import { getLlm } from "@/lib/llm/provider";
import { AGENT_ROLES } from "@/lib/agents/roles";

/**
 * Scores a TOEFL-style writing response (0-30) with feedback on six axes.
 * Uses the swappable LLM provider; with LLM_PROVIDER=mock it returns a
 * deterministic heuristic score so the feature works without API keys.
 */
export async function submitWriting(formData: FormData): Promise<void> {
  const prompt = String(formData.get("prompt") ?? "");
  const response = String(formData.get("response") ?? "").trim();
  const timed = String(formData.get("timed") ?? "") === "on";
  const duration = Number(formData.get("duration") ?? 0);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !response) return;

  const llm = getLlm();
  let scoreEstimate = heuristicScore(response);
  let feedback: Record<string, string> = heuristicFeedback(response);

  if (llm.id !== "mock") {
    const { text } = await llm.complete([
      { role: "system", content: AGENT_ROLES.eng_trainer.systemPrompt },
      {
        role: "user",
        content: `Prompt: ${prompt}\n\nResponse:\n${response}\n\nReturn JSON: {"score": number 0-30, "structure": "", "grammar": "", "clarity": "", "tone": "", "vocabulary": "", "argument": ""}`,
      },
    ]);
    try {
      const parsed = JSON.parse(text);
      scoreEstimate = Number(parsed.score) || scoreEstimate;
      feedback = parsed;
    } catch {
      feedback = { raw: text };
    }
  }

  await supabase.from("toefl_attempts").insert({
    user_id: user.id,
    prompt,
    response_text: response,
    timed,
    duration_seconds: duration || null,
    score_estimate: scoreEstimate,
    feedback,
  });
}

function heuristicScore(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  let score = 12;
  if (words > 150) score += 4;
  if (words > 300) score += 4;
  if (sentences >= 5) score += 4;
  const variety = new Set(text.toLowerCase().split(/\s+/)).size / Math.max(1, words);
  if (variety > 0.5) score += 4;
  return Math.min(30, score);
}

function heuristicFeedback(text: string): Record<string, string> {
  const words = text.split(/\s+/).filter(Boolean).length;
  return {
    structure: words < 150 ? "Develop a clearer intro–body–conclusion structure." : "Reasonable structure; ensure each paragraph has one main idea.",
    grammar: "Heuristic mode: enable an LLM provider for detailed grammar feedback.",
    clarity: "Aim for one idea per sentence and explicit transitions.",
    tone: "Maintain a formal academic register; avoid contractions.",
    vocabulary: "Vary word choice and use precise technical terms where relevant.",
    argument: words < 200 ? "Add specific examples to support your thesis." : "Good length; strengthen the link between examples and your claim.",
  };
}
