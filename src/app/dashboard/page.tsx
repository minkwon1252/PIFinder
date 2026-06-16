import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/profile";
import { TierBadge } from "@/components/TierBadge";
import { RunRow } from "./RunRow";

export default async function DashboardPage() {
  const session = await getSessionProfile();
  const supabase = await createClient();
  const userId = session!.user.id;

  const [{ data: apps }, { data: runs }, { data: shortlist }] = await Promise.all([
    supabase.from("applications").select("tier, schools(name)").eq("user_id", userId),
    supabase
      .from("search_runs")
      .select("id, mode, status, nickname, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("shortlists").select("id").eq("user_id", userId),
  ]);

  const tiers = { reach: [] as string[], target: [] as string[], foundation: [] as string[] };
  for (const a of apps ?? []) {
    const name = (a as any).schools?.name;
    if (name && tiers[a.tier as keyof typeof tiers]) tiers[a.tier as keyof typeof tiers].push(name);
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-brand">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-600">{session!.user.email}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Link href="/pi-finder" className="card hover:border-brand-accent">
          <h3 className="font-semibold">Run PI Finder →</h3>
          <p className="mt-1 text-sm text-slate-600">Find optimal professors for your targets.</p>
        </Link>
        <Link href="/shortlist" className="card hover:border-brand-accent">
          <h3 className="font-semibold">Shortlist ({shortlist?.length ?? 0}) →</h3>
          <p className="mt-1 text-sm text-slate-600">Your saved professors.</p>
        </Link>
        <Link href="/secretary" className="card hover:border-brand-accent">
          <h3 className="font-semibold">Deadlines →</h3>
          <p className="mt-1 text-sm text-slate-600">Track application requirements.</p>
        </Link>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="card">
          <h3 className="font-semibold">Your target schools</h3>
          {(["reach", "target", "foundation"] as const).map((t) => (
            <div key={t} className="mt-3">
              <TierBadge tier={t} />
              <ul className="mt-1 text-sm text-slate-600">
                {tiers[t].length ? (
                  tiers[t].map((n) => <li key={n}>• {n}</li>)
                ) : (
                  <li className="text-slate-400">None selected</li>
                )}
              </ul>
            </div>
          ))}
          <Link href="/profile" className="mt-3 inline-block text-sm text-brand-accent">
            Edit targets →
          </Link>
        </div>

        <div className="card">
          <h3 className="font-semibold">Recent PI Finder runs</h3>
          {runs?.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {runs.map((r) => (
                <RunRow key={r.id} run={r as any} />
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No runs yet.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}
