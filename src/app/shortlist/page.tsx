import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/profile";
import { removeFromShortlist, reviveCandidate } from "./actions";

export default async function ShortlistPage() {
  const session = await getSessionProfile();
  const supabase = await createClient();
  const userId = session!.user.id;

  const { data: saved } = await supabase
    .from("shortlists")
    .select(
      "id, candidate_id, note, candidate_professors(id, total_score, professor_id, professors(full_name, research_identity), schools(name))",
    )
    .eq("user_id", userId);

  const { data: eliminated } = await supabase
    .from("eliminated_candidates")
    .select(
      "candidate_id, reason, candidate_professors(professor_id, professors(full_name), schools(name))",
    )
    .eq("user_id", userId);

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-brand">Shortlist</h1>

      <section className="mt-6">
        <h2 className="font-semibold">Saved professors ({saved?.length ?? 0})</h2>
        {saved?.length ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {saved.map((s: any) => (
              <div key={s.id} className="card">
                <div className="flex items-start justify-between">
                  <Link
                    href={`/professors/${s.candidate_professors?.professor_id}`}
                    className="font-medium text-brand-accent"
                  >
                    {s.candidate_professors?.professors?.full_name}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {Number(s.candidate_professors?.total_score ?? 0).toFixed(1)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{s.candidate_professors?.schools?.name}</p>
                <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                  {s.candidate_professors?.professors?.research_identity}
                </p>
                <form action={removeFromShortlist} className="mt-3">
                  <input type="hidden" name="candidateId" value={s.candidate_id} />
                  <button className="btn-ghost text-xs">Remove</button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">
            Nothing saved yet. Run PI Finder and save candidates.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-semibold">Eliminated ({eliminated?.length ?? 0})</h2>
        <p className="text-xs text-slate-500">
          Changed your mind? Revive a professor with the new info that makes them relevant again.
        </p>
        {eliminated?.length ? (
          <div className="mt-3 space-y-3">
            {eliminated.map((e: any) => (
              <div key={e.candidate_id} className="card">
                <p className="font-medium">{e.candidate_professors?.professors?.full_name}</p>
                <p className="text-xs text-slate-500">{e.candidate_professors?.schools?.name}</p>
                {e.reason && <p className="mt-1 text-xs text-slate-400">Reason: {e.reason}</p>}
                <form action={reviveCandidate} className="mt-3 flex gap-2">
                  <input type="hidden" name="candidateId" value={e.candidate_id} />
                  <input
                    name="newInfo"
                    required
                    placeholder="What new info makes them relevant again?"
                    className="input text-xs"
                  />
                  <button className="btn-primary text-xs whitespace-nowrap">Revive</button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">No eliminated professors.</p>
        )}
      </section>
    </AppShell>
  );
}
