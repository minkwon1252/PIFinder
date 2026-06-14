"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  major1: z.string().min(1),
  major2: z.string().optional().nullable(),
  targetDegree: z.enum(["MS", "PhD", "MS_PhD", "undecided"]),
  interests: z.array(z.string().min(1)).min(2).max(3),
  method: z.enum(["experimental", "computational", "theoretical", "mixed", "unknown"]),
  applicationArea: z.string().optional().nullable(),
  projectSummary: z.string().optional().nullable(),
  // Each is an array of school names selected for that tier.
  reach: z.array(z.string()),
  target: z.array(z.string()),
  foundation: z.array(z.string()),
  cvPath: z.string().optional().nullable(),
  cvName: z.string().optional().nullable(),
});

export async function saveOnboarding(input: unknown): Promise<{ error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please complete the required fields (2–3 interests, primary major)." };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // 1) profile core fields (RLS: id = auth.uid()).
  const { error: pErr } = await supabase
    .from("profiles")
    .update({
      target_degree: data.targetDegree,
      method_preference: data.method,
      application_area: data.applicationArea ?? null,
      project_summary: data.projectSummary ?? null,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (pErr) return { error: pErr.message };

  // 2) majors (replace).
  await supabase.from("user_majors").delete().eq("user_id", user.id);
  const majors = [{ name: data.major1, is_primary: true }];
  if (data.major2) majors.push({ name: data.major2, is_primary: false });
  await supabase
    .from("user_majors")
    .insert(majors.map((m) => ({ ...m, user_id: user.id })));

  // 3) interests (replace).
  await supabase.from("user_interests").delete().eq("user_id", user.id);
  await supabase
    .from("user_interests")
    .insert(data.interests.map((keyword) => ({ user_id: user.id, keyword })));

  // 4) target schools by tier (replace). Resolve names → ids.
  await supabase.from("applications").delete().eq("user_id", user.id);
  const tiers: [string[], "reach" | "target" | "foundation"][] = [
    [data.reach, "reach"],
    [data.target, "target"],
    [data.foundation, "foundation"],
  ];
  const { data: schools } = await supabase.from("schools").select("id, name");
  const idByName = new Map((schools ?? []).map((s) => [s.name, s.id]));
  const appRows: any[] = [];
  for (const [names, tier] of tiers) {
    for (const name of names) {
      const id = idByName.get(name);
      if (id) appRows.push({ user_id: user.id, school_id: id, tier });
    }
  }
  if (appRows.length) await supabase.from("applications").insert(appRows);

  // 5) CV metadata (file already uploaded to private bucket by the client).
  if (data.cvPath && data.cvName) {
    await supabase.from("uploaded_documents").insert({
      user_id: user.id,
      kind: "cv",
      file_name: data.cvName,
      storage_path: data.cvPath,
    });
  }

  redirect("/dashboard");
}
