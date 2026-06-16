import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { CandidateCard } from "./CandidateCard";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: run } = await supabase
    .from("search_runs")
    .select("id, mode, status, created_at")
    .eq("id", id)
    .maybeSingle();

  const { data: candidates } = await supabase
    .from("candidate_professors")
    .select(
      "id, total_score, rank, fit_reason, mismatch_risk, preference_rank, professor_id, professors(full_name, research_identity), schools(name, short_name), departments(abbrev)",
    )
    .eq("search_run_id", id)
    .order("school_id")
    .order("rank");

  if (!run) {
    return (
      <AppShell>
        <p className="text-sm text-slate-600">Run not found.</p>
      </AppShell>
    );
  }

  // Group by school for display.
  const bySchool = new Map<string, any[]>();
  for (const c of candidates ?? []) {
    const key = (c as any).schools?.name ?? "Unknown";
    if (!bySchool.has(key)) bySchool.set(key, []);
    bySchool.get(key)!.push(c);
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand">
          PI Finder · {run.mode === "ultimate_match" ? "Ultimate match" : "Department list"}
        </h1>
        <span className="text-sm text-slate-500">Status: {run.status}</span>
      </div>

      {bySchool.size === 0 && (
        <p className="mt-6 text-sm text-slate-500">
          No candidates produced. Check that your target schools have seeded professors and that
          your departments overlap.
        </p>
      )}

      <div className="mt-6 space-y-6">
        {[...bySchool.entries()].map(([school, cands]) => (
          <section key={school}>
            <h2 className="text-lg font-semibold">{school}</h2>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              {cands.map((c: any) => (
                <CandidateCard key={c.id} candidate={c} runId={id} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-8">
        <Link href={`/pi-finder/run/${id}/screening`} className="btn-primary">
          Start interactive screening →
        </Link>
      </div>
    </AppShell>
  );
}
