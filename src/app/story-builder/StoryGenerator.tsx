"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Calls the backend route POST /api/story/generate (which holds the LLM key
 * server-side). Shows pending/error states and the generated angle.
 */
export function StoryGenerator({
  candidateId,
  existing,
  hasPlan,
}: {
  candidateId: string;
  existing?: string | null;
  hasPlan: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [angle, setAngle] = useState<string | null>(existing ?? null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/story/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed.");
      } else {
        setAngle(data.sopAngle ?? "");
        router.refresh(); // refresh usage counter + persisted plan
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button onClick={generate} disabled={busy} className="btn-primary text-sm">
        {busy ? "Generating…" : hasPlan || angle ? "Regenerate" : "Generate story"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {angle && (
        <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm text-slate-700">
          {angle}
        </pre>
      )}
    </div>
  );
}
