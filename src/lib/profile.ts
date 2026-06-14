import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ResearchProfile } from "@/lib/agents/types";
import type { Tier } from "@/lib/department-expansion";

/** Loads the authenticated user + profile row (RLS-protected). */
export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile };
}

/** Assembles the persistent ResearchProfile reused by every agent run. */
export async function loadResearchProfile(userId: string): Promise<ResearchProfile | null> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;

  const { data: majors } = await supabase
    .from("user_majors")
    .select("name, is_primary")
    .eq("user_id", userId)
    .order("is_primary", { ascending: false });

  const { data: interests } = await supabase
    .from("user_interests")
    .select("keyword")
    .eq("user_id", userId);

  const { data: apps } = await supabase
    .from("applications")
    .select("tier, schools(name)")
    .eq("user_id", userId);

  return {
    userId,
    majors: (majors ?? []).map((m) => m.name),
    targetDegree: profile.target_degree,
    interests: (interests ?? []).map((i) => i.keyword.toLowerCase()),
    methodPreference: profile.method_preference,
    applicationArea: profile.application_area,
    projectSummary: profile.project_summary,
    projectKeywords: extractKeywords(profile.project_summary ?? ""),
    targetSchools: (apps ?? []).map((a: any) => ({
      schoolName: a.schools?.name ?? "",
      tier: a.tier as Tier,
    })),
  };
}

/** Naive keyword extractor for project summaries (MVP). */
export function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3),
    ),
  ).slice(0, 25);
}
