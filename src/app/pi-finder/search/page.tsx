import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { saveManualCandidate } from "./actions";

const DEPTS = [
  "MSE", "EE", "ME", "ChemE", "BME", "NucE", "CS", "AP", "PHYS", "CHEM", "MATH",
  "AeroE", "CEE", "ISE", "BIO",
];

export default async function ManualSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; university?: string; department?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const university = (sp.university ?? "").trim();
  const department = (sp.department ?? "").trim();
  const hasQuery = Boolean(q || university || department);

  const supabase = await createClient();

  let results: any[] = [];
  if (hasQuery) {
    // Resolve "MIT"/"Stanford" etc. against both school name and short_name.
    let schoolNames: string[] | null = null;
    if (university) {
      const safeU = university.replace(/[,()%]/g, " ").trim();
      const { data: schoolMatches } = await supabase
        .from("schools")
        .select("name")
        .or(`name.ilike.%${safeU}%,short_name.ilike.%${safeU}%`);
      schoolNames = (schoolMatches ?? []).map((s) => s.name);
    }

    let query = supabase
      .from("professors")
      .select(
        "id, full_name, research_identity, research_themes, homepage_url, lab_name, " +
          "professor_affiliations!inner(schools!inner(name, short_name), departments!inner(name, abbrev)), " +
          "professor_metrics(h_index, citation_count, works_count)",
      )
      .order("full_name")
      .limit(60);

    if (q) {
      // Case-insensitive partial match across text fields + exact keyword match.
      const safe = q.replace(/[,()%]/g, " ").trim();
      query = query.or(
        `full_name.ilike.%${safe}%,research_identity.ilike.%${safe}%,lab_name.ilike.%${safe}%,research_themes.cs.{${safe.toLowerCase()}}`,
      );
    }
    if (schoolNames) {
      // No matching school → no results.
      query = schoolNames.length
        ? query.in("professor_affiliations.schools.name", schoolNames)
        : query.in("professor_affiliations.schools.name", ["__none__"]);
    }
    if (department) query = query.eq("professor_affiliations.departments.abbrev", department);

    const { data } = await query;
    results = data ?? [];
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand">Manual database search</h1>
        <Link href="/pi-finder" className="btn-ghost text-sm">
          ← PI Finder
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Mode C — search the professor database directly. No automated matching or AI; results come
        straight from the database with case-insensitive partial matching.
      </p>

      {/* GET form → URL searchParams (shareable, server-rendered results). */}
      <form method="get" className="card mt-4 grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="label" htmlFor="q">Keyword / name / research</label>
          <input id="q" name="q" defaultValue={q} placeholder="e.g. batteries, Langer, photonics" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="university">University</label>
          <input id="university" name="university" defaultValue={university} placeholder="e.g. MIT" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="department">Department</label>
          <select id="department" name="department" defaultValue={department} className="input">
            <option value="">Any</option>
            {DEPTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-4">
          <button type="submit" className="btn-primary">Search</button>
        </div>
      </form>

      {hasQuery && (
        <p className="mt-4 text-sm text-slate-500">
          {results.length} result{results.length === 1 ? "" : "s"}
          {results.length >= 60 && " (showing first 60 — refine your search)"}
        </p>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {results.map((p: any) => {
          const affs = p.professor_affiliations ?? [];
          const school = affs[0]?.schools?.name ?? "—";
          const depts = [...new Set(affs.map((a: any) => a.departments?.abbrev).filter(Boolean))].join(", ");
          const m = p.professor_metrics?.[0] ?? p.professor_metrics;
          return (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/professors/${p.id}`} className="font-medium text-brand-accent">
                  {p.full_name}
                </Link>
                {m?.h_index != null && (
                  <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs">h-{m.h_index}</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {school}
                {depts && ` · ${depts}`}
                {p.lab_name && ` · ${p.lab_name}`}
              </p>
              {p.research_identity && (
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{p.research_identity}</p>
              )}
              {(p.research_themes ?? []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(p.research_themes as string[]).slice(0, 5).map((t) => (
                    <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">{t}</span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <Link href={`/professors/${p.id}`} className="btn-ghost text-xs">View</Link>
                <form action={saveManualCandidate}>
                  <input type="hidden" name="professorId" value={p.id} />
                  <button className="btn-ghost text-xs" type="submit">Save to shortlist</button>
                </form>
                {p.homepage_url && (
                  <a href={p.homepage_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-accent">
                    Homepage ↗
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasQuery && results.length === 0 && (
        <p className="mt-6 text-sm text-slate-400">No professors matched. Try a broader keyword or remove filters.</p>
      )}
      {!hasQuery && (
        <p className="mt-6 text-sm text-slate-400">Enter a keyword, university, or department to search.</p>
      )}
    </AppShell>
  );
}
