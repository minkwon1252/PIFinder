import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkMembership, ensureProfile } from "@/lib/membership";

/**
 * Magic-link callback. Exchanges the code for a session, RE-VALIDATES the
 * membership gate (defense in depth), provisions the profile, then routes to
 * onboarding or the dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  // Re-check the gate even though login enforced it (defense in depth).
  const gate = await checkMembership(user.email);
  if (!gate.allowed) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_member`);
  }

  const profile = await ensureProfile({ userId: user.id, email: user.email });

  if (!profile.onboarded) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }
  return NextResponse.redirect(`${origin}${redirectTo}`);
}
