import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/profile";
import { AppNav } from "./AppNav";

/**
 * Server shell for authenticated pages. Enforces auth + onboarding, then
 * renders the nav. `requireAdmin` gates the admin section.
 */
export async function AppShell({
  children,
  requireAdmin = false,
  skipOnboardingCheck = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  skipOnboardingCheck?: boolean;
}) {
  const session = await getSessionProfile();
  if (!session?.user) redirect("/login");
  const { profile } = session;

  if (!skipOnboardingCheck && !profile?.onboarded_at) redirect("/onboarding");
  if (requireAdmin && profile?.role !== "admin") redirect("/dashboard");

  return (
    <div>
      <AppNav isAdmin={profile?.role === "admin"} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
