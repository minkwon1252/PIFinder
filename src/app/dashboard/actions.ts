"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Rename a PI Finder run. Owner-only (RLS + explicit user_id filter). Empty names rejected. */
export async function renameRun(formData: FormData): Promise<void> {
  const runId = String(formData.get("runId") ?? "");
  const nickname = String(formData.get("nickname") ?? "").trim().slice(0, 80);
  if (!runId || !nickname) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("search_runs")
    .update({ nickname })
    .eq("id", runId)
    .eq("user_id", user.id);
  revalidatePath("/dashboard");
}

/**
 * Delete a PI Finder run. Owner-only. Cascades to the run's candidates and any
 * shortlist/story rows tied to them — the UI confirms this before calling.
 */
export async function deleteRun(formData: FormData): Promise<void> {
  const runId = String(formData.get("runId") ?? "");
  if (!runId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("search_runs").delete().eq("id", runId).eq("user_id", user.id);
  revalidatePath("/dashboard");
}
