"use server";

import { createClient } from "@/lib/supabase/server";
import { checkMembership, ensureProfile } from "@/lib/membership";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Completes a magic-link sign-in. Called from the client (JS) so that email
 * scanners/prefetchers — which GET the link but don't run JS — do NOT consume
 * the one-time code. Supports both the PKCE `code` flow and the `token_hash`
 * OTP flow. Re-validates the membership gate (defense in depth) and provisions
 * the profile, then returns where to send the user.
 */
export async function completeSignIn(input: {
  code?: string | null;
  tokenHash?: string | null;
  type?: string | null;
  redirectTo?: string | null;
}): Promise<{ ok: true; redirectTo: string } | { ok: false; error: string }> {
  const supabase = await createClient();

  let exchangeError: string | null = null;
  if (input.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(input.code);
    if (error) exchangeError = error.message;
  } else if (input.tokenHash && input.type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: input.tokenHash,
      type: input.type as EmailOtpType,
    });
    if (error) exchangeError = error.message;
  } else {
    return { ok: false, error: "missing_code" };
  }

  if (exchangeError) {
    // Server-side detail for debugging; never returned to the browser verbatim.
    console.error("[auth/callback] code exchange failed:", exchangeError);
    return { ok: false, error: "exchange_failed" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "no_user" };

  // Defense in depth: re-check the membership gate even though login enforced it.
  const gate = await checkMembership(user.email);
  if (!gate.allowed) {
    await supabase.auth.signOut();
    return { ok: false, error: "not_member" };
  }

  const profile = await ensureProfile({ userId: user.id, email: user.email });
  const safeRedirect =
    input.redirectTo && input.redirectTo.startsWith("/") ? input.redirectTo : "/dashboard";
  const redirectTo = profile.onboarded ? safeRedirect : "/onboarding";
  return { ok: true, redirectTo };
}
