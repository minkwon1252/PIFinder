"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkMembership } from "@/lib/membership";
import { publicEnv } from "@/lib/env";
import { audit } from "@/lib/audit";

/**
 * Sends a passwordless magic link — but ONLY after the membership gate passes
 * (correct domain AND on the allowlist). We refuse before sending the email so
 * non-members never receive a link.
 */
export async function requestMagicLink(
  _prev: { error?: string; sent?: boolean },
  formData: FormData,
): Promise<{ error?: string; sent?: boolean }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter your email." };

  let gate;
  try {
    gate = await checkMembership(email);
  } catch (e) {
    return { error: "Membership check failed. Try again later." };
  }

  if (!gate.allowed) {
    await audit({
      actorId: null,
      action: "login.denied",
      entity: "auth",
      metadata: { email, reason: gate.reason },
    });
    if (gate.reason === "domain") {
      return { error: `Only @${publicEnv.allowedEmailDomain} emails may sign in.` };
    }
    return {
      error:
        "This email is not on the STEM member allowlist. Ask an admin to add you.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${publicEnv.appUrl}/auth/callback`,
      shouldCreateUser: true,
    },
  });
  if (error) return { error: error.message };

  return { sent: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
