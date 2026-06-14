import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/profile";

const STALE_DAYS = 30;

export default async function SecretaryPage() {
  const session = await getSessionProfile();
  const supabase = await createClient();
  const userId = session!.user.id;

  // Deadlines for the user's target schools.
  const { data: apps } = await supabase
    .from("applications")
    .select("school_id, schools(name)")
    .eq("user_id", userId);
  const schoolIds = (apps ?? []).map((a) => a.school_id);

  const { data: deadlines } = schoolIds.length
    ? await supabase
        .from("deadlines")
        .select(
          "id, term, application_deadline, priority_deadline, financial_aid_deadline, required_documents, english_requirement, gre_status, application_fee, portal_url, last_checked_at, schools(name)",
        )
        .in("school_id", schoolIds)
    : { data: [] as any[] };

  const now = Date.now();

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-brand">Secretary · Deadlines</h1>
      <p className="mt-1 text-sm text-slate-600">
        Tracked from official admissions pages. Every deadline shows its last-checked date; stale
        entries are flagged.
      </p>

      {deadlines && deadlines.length > 0 ? (
        <div className="mt-6 space-y-4">
          {deadlines.map((d: any) => {
            const checked = d.last_checked_at ? new Date(d.last_checked_at).getTime() : 0;
            const stale = !checked || (now - checked) / 86400000 > STALE_DAYS;
            return (
              <div key={d.id} className="card">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">
                    {d.schools?.name} {d.term && `· ${d.term}`}
                  </h3>
                  {stale ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      ⚠ Data may be stale — verify on official page
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">
                      Checked {new Date(d.last_checked_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
                  <Item label="Application" value={d.application_deadline} />
                  <Item label="Priority" value={d.priority_deadline} />
                  <Item label="Financial aid" value={d.financial_aid_deadline} />
                  <Item label="English" value={d.english_requirement} />
                  <Item label="GRE" value={d.gre_status} />
                  <Item label="Fee" value={d.application_fee} />
                </dl>
                {d.portal_url && (
                  <a href={d.portal_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-brand-accent underline">
                    Application portal →
                  </a>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-400">
          No deadlines recorded for your target schools yet. An admin can add them in the admin
          panel, and the Secretary Agent will source them from official pages in Phase 4.
        </p>
      )}
    </AppShell>
  );
}

function Item({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value ?? "—"}</dd>
    </div>
  );
}
