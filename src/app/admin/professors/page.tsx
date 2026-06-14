import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";

export default async function AdminProfessorsPage() {
  const supabase = await createClient();
  const { data: professors } = await supabase
    .from("professors")
    .select("id, full_name, research_identity, research_themes")
    .order("full_name");

  return (
    <AppShell requireAdmin>
      <h1 className="text-2xl font-bold text-brand">Professors</h1>
      <p className="mt-1 text-sm text-slate-600">
        Professor records are populated by the source adapters (mock in MVP; OpenAlex / Semantic
        Scholar / official pages in Phase 3). Every record must carry source provenance.
      </p>

      <div className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {(professors ?? []).map((p) => (
          <Link
            key={p.id}
            href={`/professors/${p.id}`}
            className="block px-4 py-3 text-sm hover:bg-slate-50"
          >
            <span className="font-medium">{p.full_name}</span>
            <p className="text-slate-500">{p.research_identity}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {(p.research_themes ?? []).map((t: string) => (
                <span key={t} className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs">
                  {t}
                </span>
              ))}
            </div>
          </Link>
        ))}
        {(!professors || professors.length === 0) && (
          <p className="px-4 py-3 text-sm text-slate-400">No professors yet. Run the seed.</p>
        )}
      </div>
    </AppShell>
  );
}
