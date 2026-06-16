import { LoginForm } from "./LoginForm";
import { publicEnv } from "@/lib/env";
import { authErrorMessage } from "@/lib/auth-errors";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const initialError = authErrorMessage(sp.error);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-bold text-brand">Sign in to PIFinder</h1>
      <p className="mt-2 text-sm text-slate-600">
        STEM members only. We&apos;ll email you a secure sign-in link.
      </p>

      <LoginForm initialError={initialError} />

      <p className="mt-6 text-xs text-slate-500">
        Access requires an <code>@{publicEnv.allowedEmailDomain}</code> email that is on the
        admin-maintained STEM member allowlist.
      </p>
    </main>
  );
}
