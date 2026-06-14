"use client";

import { useActionState } from "react";
import { requestMagicLink } from "./actions";
import { publicEnv } from "@/lib/env";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(requestMagicLink, {});

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-bold text-brand">Sign in to PIFinder</h1>
      <p className="mt-2 text-sm text-slate-600">
        STEM members only. We&apos;ll email you a secure sign-in link.
      </p>

      {state.sent ? (
        <div className="card mt-6 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-800">
            Check your inbox for a sign-in link. You can close this tab.
          </p>
        </div>
      ) : (
        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">
              SNU email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder={`you@${publicEnv.allowedEmailDomain}`}
              className="input"
            />
          </div>
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Checking…" : "Send sign-in link"}
          </button>
        </form>
      )}

      <p className="mt-6 text-xs text-slate-500">
        Access requires an <code>@{publicEnv.allowedEmailDomain}</code> email that is on the
        admin-maintained STEM member allowlist.
      </p>
    </main>
  );
}
