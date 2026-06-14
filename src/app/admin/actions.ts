"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

/** Verify the caller is an admin before any privileged action. */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") throw new Error("Forbidden");
  return user;
}

export async function addMember(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const note = String(formData.get("note") ?? "");
  if (!email) return;

  const svc = createAdminClient();
  await svc.from("member_allowlist").upsert(
    { email, note, added_by: admin.id },
    { onConflict: "email" },
  );
  await audit({
    actorId: admin.id,
    action: "allowlist.add",
    entity: "member_allowlist",
    entityId: email,
    metadata: { note },
  });
  revalidatePath("/admin/members");
}

export async function removeMember(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return;

  const svc = createAdminClient();
  await svc.from("member_allowlist").delete().eq("email", email);
  await audit({
    actorId: admin.id,
    action: "allowlist.remove",
    entity: "member_allowlist",
    entityId: email,
  });
  revalidatePath("/admin/members");
}

export async function setRole(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  const role = String(formData.get("role")) === "admin" ? "admin" : "member";

  const svc = createAdminClient();
  await svc.from("profiles").update({ role }).eq("id", userId);
  await audit({
    actorId: admin.id,
    action: "profile.set_role",
    entity: "profiles",
    entityId: userId,
    metadata: { role },
  });
  revalidatePath("/admin/members");
}

export async function addSchool(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const short_name = String(formData.get("short_name") ?? "").trim() || null;
  const admissions_url = String(formData.get("admissions_url") ?? "").trim() || null;
  if (!name) return;
  const supabase = await createClient(); // RLS allows admin writes
  await supabase.from("schools").upsert({ name, short_name, admissions_url }, { onConflict: "name" });
  await audit({ actorId: admin.id, action: "schools.add", entity: "schools", entityId: name });
  revalidatePath("/admin/schools");
}

export async function addDeadline(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const school_id = String(formData.get("school_id"));
  const term = String(formData.get("term") ?? "") || null;
  const application_deadline = String(formData.get("application_deadline") ?? "") || null;
  const portal_url = String(formData.get("portal_url") ?? "") || null;
  if (!school_id) return;
  const supabase = await createClient();
  await supabase.from("deadlines").insert({
    school_id,
    term,
    application_deadline,
    portal_url,
    last_checked_at: new Date().toISOString(),
  });
  await audit({ actorId: admin.id, action: "deadlines.add", entity: "deadlines", entityId: school_id });
  revalidatePath("/admin/deadlines");
}
