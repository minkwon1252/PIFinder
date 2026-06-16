"use client";

import { useActionState } from "react";
import { requestMagicLink } from "./actions";
import { publicEnv } from "@/lib/env";

export function LoginForm({ initialError }: { initialError?: string | null }) {
  const [state, formAction, pending] = useActionState(requestMagicLink, {});

  return (
    <>
      {initialError && !state.sent && (
        <div className="card mt-6 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">{initialError}</p>
        </div>
      )}

      {state.sent ? (
        <div className="card mt-6 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-800">
            Check your inbox for a sign-in link. You can close this tab.
          </p>
        </div>
      ) : (
        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">SNU email</label>
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
    </>
  );
}
