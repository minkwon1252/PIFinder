import "server-only";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * STEM membership gate.
 *
 * A user may enter ONLY IF BOTH are true:
 *   1. email ends with the allowed domain (default snu.ac.kr)
 *   2. email is present in the admin-maintained member_allowlist
 *
 * We deliberately do NOT auto-admit all snu.ac.kr users.
 */

export function emailHasAllowedDomain(email: string): boolean {
  const domain = publicEnv.allowedEmailDomain.toLowerCase();
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith(`@${domain}`) || normalized.endsWith(`.${domain}`);
}

export type GateResult =
  | { allowed: true; isBootstrapAdmin: boolean }
  | { allowed: false; reason: "domain" | "not_allowlisted" };

/** Pure check used by tests — no DB. */
export function checkDomainGate(email: string): boolean {
  return emailHasAllowedDomain(email);
}

/**
 * Full gate check. Uses the service role to read the allowlist because a
 * profile may not exist yet (so RLS-bound clients cannot read it).
 */
export async function checkMembership(email: string): Promise<GateResult> {
  const normalized = email.trim().toLowerCase();

  if (!emailHasAllowedDomain(normalized)) {
    return { allowed: false, reason: "domain" };
  }

  const { bootstrapAdminEmails } = serverEnv();
  const isBootstrapAdmin = bootstrapAdminEmails.includes(normalized);

  // Bootstrap admins are implicitly allowlisted so the first admin can log in.
  if (isBootstrapAdmin) {
    return { allowed: true, isBootstrapAdmin: true };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("member_allowlist")
    .select("email")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`Allowlist lookup failed: ${error.message}`);
  }
  if (!data) {
    return { allowed: false, reason: "not_allowlisted" };
  }
  return { allowed: true, isBootstrapAdmin: false };
}

/**
 * Ensure a profile row exists for the authenticated user, creating it on first
 * login. Promotes bootstrap admins to the admin role. Returns the profile.
 */
export async function ensureProfile(params: {
  userId: string;
  email: string;
}): Promise<{ id: string; role: "member" | "admin"; onboarded: boolean }> {
  const normalized = params.email.trim().toLowerCase();
  const { bootstrapAdminEmails } = serverEnv();
  const isBootstrapAdmin = bootstrapAdminEmails.includes(normalized);

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("id, role, onboarded_at")
    .eq("id", params.userId)
    .maybeSingle();

  if (existing) {
    // Keep bootstrap admins as admin even if their row predates promotion.
    if (isBootstrapAdmin && existing.role !== "admin") {
      await admin.from("profiles").update({ role: "admin" }).eq("id", params.userId);
      existing.role = "admin";
    }
    return {
      id: existing.id,
      role: existing.role,
      onboarded: Boolean(existing.onboarded_at),
    };
  }

  const role = isBootstrapAdmin ? "admin" : "member";
  const { error } = await admin.from("profiles").insert({
    id: params.userId,
    email: normalized,
    role,
  });
  if (error) {
    throw new Error(`Profile creation failed: ${error.message}`);
  }
  return { id: params.userId, role, onboarded: false };
}
