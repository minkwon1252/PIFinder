"use client";

import { useFormStatus } from "react-dom";
import { FunFacts } from "./FunFacts";

/**
 * Submit button for a PI Finder run. While the run computes (can take up to a
 * minute) it shows a full-screen overlay with a spinner and rotating fun facts,
 * so the wait feels intentional instead of broken.
 */
export function RunButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        className="btn-primary mt-4 inline-flex items-center gap-2"
        type="submit"
        disabled={pending}
        aria-busy={pending}
      >
        {pending && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
          </svg>
        )}
        {pending ? "Running…" : label}
      </button>

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="status" aria-live="polite">
          <div className="w-full max-w-md space-y-4 text-center">
            <div className="flex items-center justify-center gap-2 text-white">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
              </svg>
              <span className="font-medium">Finding your best-fit professors… this can take up to a minute.</span>
            </div>
            <FunFacts />
            <p className="text-xs text-slate-300">Keep this tab open — we&apos;ll take you to the results automatically.</p>
          </div>
        </div>
      )}
    </>
  );
}
