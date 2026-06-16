import Link from "next/link";
import { CompleteSignIn } from "./CompleteSignIn";
import { authErrorMessage } from "@/lib/auth-errors";

/**
 * Magic-link callback. Renders a tiny page that completes the sign-in via JS
 * (see CompleteSignIn) so email scanners that only GET the link don't consume
 * the one-time code. Supabase-provided errors (e.g. expired link) are shown
 * directly without attempting an exchange.
 */
export default async function CallbackPage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string;
    token_hash?: string;
    type?: string;
    redirectTo?: string;
    error?: string;
    error_code?: string;
    error_description?: string;
  }>;
}) {
  const sp = await searchParams;
  const providerError = sp.error_code || sp.error;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-bold text-brand">PIFinder</h1>
      <div className="mt-6">
        {providerError ? (
          <div className="card border-red-200 bg-red-50">
            <p className="text-sm text-red-700">{authErrorMessage(providerError)}</p>
            <Link href="/login" className="btn-primary mt-3 inline-block text-sm">
              Back to sign in
            </Link>
          </div>
        ) : (
          <CompleteSignIn
            code={sp.code ?? null}
            tokenHash={sp.token_hash ?? null}
            type={sp.type ?? null}
            redirectTo={sp.redirectTo ?? null}
          />
        )}
      </div>
    </main>
  );
}
