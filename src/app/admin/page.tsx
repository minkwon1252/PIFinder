import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const [{ count: members }, { count: schools }, { count: professors }, { data: audit }] =
    await Promise.all([
      supabase.from("member_allowlist").select("id", { count: "exact", head: true }),
      supabase.from("schools").select("id", { count: "exact", head: true }),
      supabase.from("professors").select("id", { count: "exact", head: true }),
      supabase
        .from("audit_logs")
        .select("action, actor_id, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  return (
    <AppShell requireAdmin>
      <h1 className="text-2xl font-bold text-brand">Admin panel</h1>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Stat label="Allowlist" value={members ?? 0} href="/admin/members" />
        <Stat label="Schools" value={schools ?? 0} href="/admin/schools" />
        <Stat label="Professors" value={professors ?? 0} href="/admin/professors" />
        <Stat label="Deadlines" value="" href="/admin/deadlines" />
      </div>

      <section className="card mt-8">
        <h2 className="font-semibold">Recent admin activity (audit log)</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {(audit ?? []).map((a, i) => (
            <li key={i} className="flex justify-between text-slate-600">
              <span>{a.action}</span>
              <span className="text-slate-400">
                {new Date(a.created_at).toLocaleString()}
              </span>
            </li>
          ))}
          {(!audit || audit.length === 0) && <li className="text-slate-400">No activity yet.</li>}
        </ul>
      </section>
    </AppShell>
  );
}

function Stat({ label, value, href }: { label: string; value: number | string; href: string }) {
  return (
    <Link href={href} className="card hover:border-brand-accent">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand">{value}</p>
      <p className="mt-1 text-xs text-brand-accent">Manage →</p>
    </Link>
  );
}
