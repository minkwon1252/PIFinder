import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { addSchool } from "../actions";

export default async function AdminSchoolsPage() {
  const supabase = await createClient();
  const { data: schools } = await supabase
    .from("schools")
    .select("id, name, short_name, admissions_url")
    .order("name");

  return (
    <AppShell requireAdmin>
      <h1 className="text-2xl font-bold text-brand">Schools & departments</h1>

      <section className="card mt-6">
        <h2 className="font-semibold">Add / update school</h2>
        <form action={addSchool} className="mt-3 flex flex-wrap gap-2">
          <input name="name" required placeholder="Full name" className="input max-w-xs" />
          <input name="short_name" placeholder="Short name" className="input max-w-[10rem]" />
          <input name="admissions_url" placeholder="Admissions URL" className="input max-w-xs" />
          <button className="btn-primary">Save</button>
        </form>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Schools ({schools?.length ?? 0})</h2>
        <div className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {(schools ?? []).map((s) => (
            <div key={s.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>
                <span className="font-medium">{s.name}</span>
                {s.short_name && <span className="ml-2 text-slate-400">{s.short_name}</span>}
              </span>
              {s.admissions_url && (
                <a href={s.admissions_url} target="_blank" rel="noreferrer" className="text-xs text-brand-accent underline">
                  admissions
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
