import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/profile";
import { generateStory } from "./actions";

export default async function StoryBuilderPage() {
  const session = await getSessionProfile();
  const supabase = await createClient();
  const userId = session!.user.id;

  const { data: saved } = await supabase
    .from("shortlists")
    .select(
      "candidate_id, candidate_professors(professors(full_name), schools(name))",
    )
    .eq("user_id", userId);

  const { data: plans } = await supabase
    .from("story_plans")
    .select("candidate_id, sop_angle, school_reason, department_reason")
    .eq("user_id", userId);
  const planByCand = new Map((plans ?? []).map((p) => [p.candidate_id, p]));

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-brand">Story Builder</h1>
      <p className="mt-1 text-sm text-slate-600">
        Honest, professor-specific application angles grounded in your real CV. We never invent
        experience, publications, awards, or connections.
      </p>

      {saved?.length ? (
        <div className="mt-6 space-y-4">
          {saved.map((s: any) => {
            const plan = planByCand.get(s.candidate_id);
            return (
              <div key={s.candidate_id} className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{s.candidate_professors?.professors?.full_name}</p>
                    <p className="text-xs text-slate-500">
                      {s.candidate_professors?.schools?.name}
                    </p>
                  </div>
                  <form action={generateStory}>
                    <input type="hidden" name="candidateId" value={s.candidate_id} />
                    <button className="btn-primary text-sm">
                      {plan ? "Regenerate" : "Generate story"}
                    </button>
                  </form>
                </div>
                {plan?.sop_angle && (
                  <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm text-slate-700">
                    {plan.sop_angle}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-400">
          Save professors to your shortlist first, then build their stories here.
        </p>
      )}
    </AppShell>
  );
}
