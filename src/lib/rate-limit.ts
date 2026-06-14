import "server-only";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Usage tracking / rate limiting for expensive AI & search actions.
 * Counts search_runs created by the user in the last 24h against the per-day
 * cap. This is a simple DB-backed limiter suitable for MVP; swap for Redis or
 * Supabase rate-limit edge functions later.
 */
export async function checkRunRateLimit(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
}> {
  const { rateLimitRunsPerDay } = serverEnv();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const admin = createAdminClient();
  const { count, error } = await admin
    .from("search_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) throw new Error(`Rate-limit check failed: ${error.message}`);

  const used = count ?? 0;
  return {
    allowed: used < rateLimitRunsPerDay,
    used,
    limit: rateLimitRunsPerDay,
  };
}
