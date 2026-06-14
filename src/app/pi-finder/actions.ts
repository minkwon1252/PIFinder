"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadResearchProfile } from "@/lib/profile";
import { runPiFinder } from "@/lib/agents/pipeline";
import { checkRunRateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export async function startPiFinderRun(formData: FormData): Promise<void> {
  const mode = (String(formData.get("mode") ?? "department_list") === "ultimate_match"
    ? "ultimate_match"
    : "department_list") as "department_list" | "ultimate_match";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Usage tracking / rate limiting for this expensive action.
  const rl = await checkRunRateLimit(user.id);
  if (!rl.allowed) {
    redirect(`/pi-finder?error=rate_limited&used=${rl.used}&limit=${rl.limit}`);
  }

  const profile = await loadResearchProfile(user.id);
  if (!profile || profile.targetSchools.length === 0) {
    redirect("/pi-finder?error=no_targets");
  }

  const { data: run, error } = await supabase
    .from("search_runs")
    .insert({ user_id: user.id, mode, status: "running", params: { mode } })
    .select("id")
    .single();
  if (error || !run) redirect("/pi-finder?error=run_failed");

  await audit({
    actorId: user.id,
    action: "search_run.create",
    entity: "search_runs",
    entityId: run.id,
    metadata: { mode },
  });

  await runPiFinder({ userId: user.id, searchRunId: run.id, mode, profile: profile! });

  redirect(`/pi-finder/run/${run.id}`);
}
