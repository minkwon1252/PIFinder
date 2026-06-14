import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { addToShortlist, eliminateCandidate } from "@/app/shortlist/actions";

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
      "id, total_score, rank, fit_reason, mismatch_risk, professor_id, professors(full_name, research_identity), schools(name, short_name), departments(abbrev)",
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
                <div key={c.id} className="card">
                  <div className="flex items-start justify-between">
                    <Link
                      href={`/professors/${c.professor_id}`}
                      className="font-medium text-brand-accent"
                    >
                      {c.professors?.full_name}
                    </Link>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold">
                      {Number(c.total_score).toFixed(1)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{c.departments?.abbrev}</p>
                  <p className="mt-2 text-sm text-slate-600 line-clamp-3">
                    {c.professors?.research_identity}
                  </p>
                  {c.mismatch_risk && (
                    <p className="mt-2 text-xs text-amber-700">⚠ {c.mismatch_risk}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <form action={addToShortlist}>
                      <input type="hidden" name="candidateId" value={c.id} />
                      <button className="btn-ghost text-xs" type="submit">
                        Save
                      </button>
                    </form>
                    <form action={eliminateCandidate}>
                      <input type="hidden" name="candidateId" value={c.id} />
                      <button className="btn-ghost text-xs text-slate-500" type="submit">
                        Eliminate
                      </button>
                    </form>
                  </div>
                </div>
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
