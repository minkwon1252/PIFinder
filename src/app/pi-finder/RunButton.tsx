"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button for a PI Finder run. Uses the form's pending state to show a
 * spinner + "Running…" and disable the button, so the user gets immediate
 * feedback (the run can take several seconds). Must live inside the <form>.
 */
export function RunButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary mt-4 inline-flex items-center gap-2" type="submit" disabled={pending} aria-busy={pending}>
      {pending && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
        </svg>
      )}
      {pending ? "Running… this can take a few seconds" : label}
    </button>
  );
}
