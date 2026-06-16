import "server-only";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LlmUsage } from "./provider";

/**
 * LLM usage tracking + per-user monthly quota for backend LLM features.
 * Usage rows are written server-side via the service role (the llm_usage table
 * has no public insert policy); users read their own rows via RLS.
 */

export type LlmFeature = "story_generation";

/** Very rough cost estimate (USD). Tune per provider/model as needed. */
function estimateCost(provider: string, usage: LlmUsage): number | null {
  if (provider !== "anthropic") return 0;
  // Opus-class rough rates: ~$15 / 1M input, ~$75 / 1M output.
  const cost = (usage.inputTokens / 1_000_000) * 15 + (usage.outputTokens / 1_000_000) * 75;
  return Math.round(cost * 1e5) / 1e5;
}

function monthStartISO(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

/** Monthly quota check for a feature (counts successful requests this calendar month, UTC). */
export async function checkMonthlyQuota(
  userId: string,
  feature: LlmFeature,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const { monthlyStoryGenerationLimit } = serverEnv();
  const limit = monthlyStoryGenerationLimit;
  const admin = createAdminClient();
  const { count } = await admin
    .from("llm_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", feature)
    .eq("success", true)
    .gte("created_at", monthStartISO());
  const used = count ?? 0;
  return { allowed: limit <= 0 || used < limit, used, limit };
}

/** This month's usage summary for display (requests + tokens). */
export async function monthlyUsageSummary(
  userId: string,
  feature: LlmFeature,
): Promise<{ requests: number; tokens: number; limit: number }> {
  const { monthlyStoryGenerationLimit } = serverEnv();
  const admin = createAdminClient();
  const { data } = await admin
    .from("llm_usage")
    .select("total_tokens")
    .eq("user_id", userId)
    .eq("feature", feature)
    .eq("success", true)
    .gte("created_at", monthStartISO());
  const rows = data ?? [];
  return {
    requests: rows.length,
    tokens: rows.reduce((n, r) => n + (r.total_tokens ?? 0), 0),
    limit: monthlyStoryGenerationLimit,
  };
}

/** Records one usage row (success or failure). Never throws into the caller path. */
export async function logLlmUsage(row: {
  userId: string;
  feature: LlmFeature;
  provider: string;
  model: string;
  usage?: LlmUsage;
  success: boolean;
  errorType?: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("llm_usage").insert({
      user_id: row.userId,
      feature: row.feature,
      provider: row.provider,
      model: row.model,
      input_tokens: row.usage?.inputTokens ?? null,
      output_tokens: row.usage?.outputTokens ?? null,
      total_tokens: row.usage?.totalTokens ?? null,
      estimated_cost: row.usage ? estimateCost(row.provider, row.usage) : null,
      success: row.success,
      error_type: row.errorType ?? null,
    });
  } catch {
    // Usage logging must not break the user-facing request.
  }
}
