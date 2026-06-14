import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { getSessionProfile, loadResearchProfile } from "@/lib/profile";
import { TierBadge } from "@/components/TierBadge";

export default async function ProfilePage() {
  const session = await getSessionProfile();
  const rp = await loadResearchProfile(session!.user.id);

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand">Research Profile</h1>
        <Link href="/onboarding" className="btn-ghost text-sm">
          Edit profile
        </Link>
      </div>

      {rp ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Majors" value={rp.majors.join(", ") || "—"} />
          <Field label="Target degree" value={rp.targetDegree} />
          <Field label="Method preference" value={rp.methodPreference} />
          <Field label="Application area" value={rp.applicationArea ?? "—"} />
          <Field label="Research interests" value={rp.interests.join(", ") || "—"} />
          <div className="card">
            <p className="text-xs text-slate-400">Target schools</p>
            <div className="mt-2 space-y-1 text-sm">
              {(["reach", "target", "foundation"] as const).map((t) => {
                const names = rp.targetSchools.filter((s) => s.tier === t).map((s) => s.schoolName);
                return (
                  <div key={t} className="flex items-start gap-2">
                    <TierBadge tier={t} />
                    <span className="text-slate-700">{names.join(", ") || "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card md:col-span-2">
            <p className="text-xs text-slate-400">Project summary</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {rp.projectSummary ?? "—"}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-400">No profile yet.</p>
      )}
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-700">{value}</p>
    </div>
  );
}
