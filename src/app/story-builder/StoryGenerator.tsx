"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Provider {
  id: string;
  label: string;
}

/**
 * Calls the backend route POST /api/story/generate (which holds the LLM keys
 * server-side). The user can pick which configured provider to use; only the
 * provider *id* is sent — never a key. Shows pending/error states.
 */
export function StoryGenerator({
  candidateId,
  existing,
  hasPlan,
  providers,
}: {
  candidateId: string;
  existing?: string | null;
  hasPlan: boolean;
  providers: Provider[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [angle, setAngle] = useState<string | null>(existing ?? null);
  const [provider, setProvider] = useState<string>(providers[0]?.id ?? "");
  const [fallback, setFallback] = useState<{ requested: string; used: string; model: string } | null>(null);

  const labelFor = (id: string) => providers.find((p) => p.id === id)?.label ?? id;

  async function generate() {
    setBusy(true);
    setError(null);
    setDetail(null);
    setFallback(null);
    try {
      const res = await fetch("/api/story/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, provider: provider || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed.");
        setDetail(data.detail ?? null);
      } else {
        setAngle(data.sopAngle ?? "");
        setFallback(
          data.fellBack
            ? { requested: data.requestedProvider, used: data.provider, model: data.model }
            : null,
        );
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {providers.length > 1 && (
          <label className="text-xs text-slate-600">
            Model:{" "}
            <select
              className="rounded border border-slate-300 px-1 py-0.5 text-xs"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={busy}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {providers.length === 1 && (
          <span className="text-xs text-slate-500">via {providers[0]!.label}</span>
        )}
        <button onClick={generate} disabled={busy} className="btn-primary text-sm">
          {busy ? "Generating…" : hasPlan || angle ? "Regenerate" : "Generate story"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {detail && (
        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-red-50 p-2 text-xs text-red-700">
          {detail}
        </pre>
      )}
      {angle && fallback && (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠️ {labelFor(fallback.requested)} was unavailable (rate limit / high demand), so this story
          was written by <strong>{labelFor(fallback.used)}</strong> ({fallback.model}) instead.
        </p>
      )}
      {angle && (
        <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm text-slate-700">
          {angle}
        </pre>
      )}
    </div>
  );
}
