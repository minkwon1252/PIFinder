import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { addMember, removeMember, setRole } from "../actions";

export default async function AdminMembersPage() {
  const supabase = await createClient();
  const { data: allowlist } = await supabase
    .from("member_allowlist")
    .select("email, note, created_at")
    .order("created_at", { ascending: false });
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, role, onboarded_at");

  return (
    <AppShell requireAdmin>
      <h1 className="text-2xl font-bold text-brand">Members & allowlist</h1>

      <section className="card mt-6">
        <h2 className="font-semibold">Add to allowlist</h2>
        <form action={addMember} className="mt-3 flex flex-wrap gap-2">
          <input name="email" type="email" required placeholder="member@snu.ac.kr" className="input max-w-xs" />
          <input name="note" placeholder="note (optional)" className="input max-w-xs" />
          <button className="btn-primary" type="submit">
            Add
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Only allowlisted <code>@snu.ac.kr</code> emails can sign in. We never auto-admit all SNU
          users.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Allowlist ({allowlist?.length ?? 0})</h2>
        <div className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {(allowlist ?? []).map((m) => (
            <div key={m.email} className="flex items-center justify-between px-4 py-2 text-sm">
              <div>
                <span className="font-medium">{m.email}</span>
                {m.note && <span className="ml-2 text-slate-400">{m.note}</span>}
              </div>
              <form action={removeMember}>
                <input type="hidden" name="email" value={m.email} />
                <button className="text-xs text-red-600 hover:underline">Remove</button>
              </form>
            </div>
          ))}
          {(!allowlist || allowlist.length === 0) && (
            <p className="px-4 py-3 text-sm text-slate-400">No allowlisted emails.</p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Registered users & roles</h2>
        <div className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {(profiles ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <div>
                <span className="font-medium">{p.email}</span>
                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs">{p.role}</span>
                {!p.onboarded_at && <span className="ml-2 text-xs text-amber-600">not onboarded</span>}
              </div>
              <form action={setRole}>
                <input type="hidden" name="userId" value={p.id} />
                <input type="hidden" name="role" value={p.role === "admin" ? "member" : "admin"} />
                <button className="text-xs text-brand-accent hover:underline">
                  {p.role === "admin" ? "Demote to member" : "Promote to admin"}
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
