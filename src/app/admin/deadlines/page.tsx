import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { addDeadline } from "../actions";

export default async function AdminDeadlinesPage() {
  const supabase = await createClient();
  const { data: schools } = await supabase.from("schools").select("id, name").order("name");
  const { data: deadlines } = await supabase
    .from("deadlines")
    .select("id, term, application_deadline, last_checked_at, schools(name)")
    .order("application_deadline", { ascending: true });

  return (
    <AppShell requireAdmin>
      <h1 className="text-2xl font-bold text-brand">Deadlines</h1>

      <section className="card mt-6">
        <h2 className="font-semibold">Add deadline</h2>
        <form action={addDeadline} className="mt-3 flex flex-wrap items-end gap-2">
          <select name="school_id" required className="input max-w-xs">
            <option value="">Select school…</option>
            {(schools ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input name="term" placeholder="Fall 2027" className="input max-w-[10rem]" />
          <input name="application_deadline" type="date" className="input max-w-[12rem]" />
          <input name="portal_url" placeholder="Portal URL" className="input max-w-xs" />
          <button className="btn-primary">Add</button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Every deadline records a last-checked timestamp. The Secretary flags entries older than
          30 days as stale.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Tracked deadlines ({deadlines?.length ?? 0})</h2>
        <div className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {(deadlines ?? []).map((d: any) => (
            <div key={d.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>
                <span className="font-medium">{d.schools?.name}</span>
                {d.term && <span className="ml-2 text-slate-400">{d.term}</span>}
              </span>
              <span className="text-slate-500">{d.application_deadline ?? "—"}</span>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
