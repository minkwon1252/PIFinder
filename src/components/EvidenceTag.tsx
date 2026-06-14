import type { EvidenceKind } from "@/lib/agents/types";

/** Surfaces the evidence policy in the UI: facts vs. inference vs. missing. */
export function EvidenceTag({ kind }: { kind: EvidenceKind }) {
  const map: Record<EvidenceKind, { label: string; cls: string }> = {
    verified_fact: { label: "Verified", cls: "bg-emerald-100 text-emerald-800" },
    inferred_fit: { label: "Inferred", cls: "bg-amber-100 text-amber-800" },
    user_provided: { label: "You provided", cls: "bg-blue-100 text-blue-800" },
    missing_uncertain: { label: "Missing / uncertain", cls: "bg-slate-200 text-slate-700" },
  };
  const { label, cls } = map[kind];
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
