"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { completeSignIn } from "./actions";
import { authErrorMessage } from "@/lib/auth-errors";

/**
 * Triggers the magic-link code exchange from the browser (not on plain GET), so
 * email-client link scanners that prefetch the URL without running JS cannot
 * consume the one-time code. The real user's browser runs this and signs in.
 */
export function CompleteSignIn({
  code,
  tokenHash,
  type,
  redirectTo,
}: {
  code?: string | null;
  tokenHash?: string | null;
  type?: string | null;
  redirectTo?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // run the one-time exchange exactly once
    started.current = true;
    completeSignIn({ code, tokenHash, type, redirectTo })
      .then((res) => {
        if (res.ok) router.replace(res.redirectTo);
        else setError(res.error);
      })
      .catch(() => setError("exchange_failed"));
  }, [code, tokenHash, type, redirectTo, router]);

  if (error) {
    return (
      <div className="card border-red-200 bg-red-50">
        <p className="text-sm text-red-700">{authErrorMessage(error)}</p>
        <Link href="/login" className="btn-primary mt-3 inline-block text-sm">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="card flex items-center gap-3">
      <svg className="h-5 w-5 animate-spin text-brand-accent" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
      </svg>
      <p className="text-sm text-slate-600">Signing you in…</p>
    </div>
  );
}
