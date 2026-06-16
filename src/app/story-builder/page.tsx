import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/profile";
import { availableProviders } from "@/lib/llm/provider";
import { monthlyUsageSummary } from "@/lib/llm/usage";
import { StoryGenerator } from "./StoryGenerator";

export default async function StoryBuilderPage() {
  const session = await getSessionProfile();
  const supabase = await createClient();
  const userId = session!.user.id;

  const { data: saved } = await supabase
    .from("shortlists")
    .select("candidate_id, candidate_professors(professors(full_name), schools(name))")
    .eq("user_id", userId);

  const { data: plans } = await supabase
    .from("story_plans")
    .select("candidate_id, sop_angle")
    .eq("user_id", userId);
  const planByCand = new Map((plans ?? []).map((p) => [p.candidate_id, p]));

  const usage = await monthlyUsageSummary(userId, "story_generation");
  const providers = availableProviders();
  const configured = providers.length > 0;

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-brand">Story Builder</h1>
      <p className="mt-1 text-sm text-slate-600">
        Honest, professor-specific application angles grounded in the text of your uploaded CV and
        &ldquo;story&rdquo; file (PDF or .txt). We never invent experience, publications, awards, or
        connections. Upload or update files in your{" "}
        <a href="/onboarding" className="text-brand-accent underline">profile</a>.
      </p>

      {/* Usage / quota (Issue 4) */}
      <div className="card mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-slate-600">
          This month: <strong>{usage.requests}</strong>
          {usage.limit > 0 && <> / {usage.limit}</>} story generations
          {usage.tokens > 0 && <> · ~{usage.tokens.toLocaleString()} tokens</>}
        </span>
        {!configured && (
          <span className="text-amber-700">
            Demo mode — generations use a placeholder model until an API key is configured.
          </span>
        )}
      </div>

      {saved?.length ? (
        <div className="mt-6 space-y-4">
          {saved.map((s: any) => {
            const plan = planByCand.get(s.candidate_id);
            return (
              <div key={s.candidate_id} className="card">
                <p className="font-medium">{s.candidate_professors?.professors?.full_name}</p>
                <p className="text-xs text-slate-500">{s.candidate_professors?.schools?.name}</p>
                <div className="mt-3">
                  <StoryGenerator
                    candidateId={s.candidate_id}
                    existing={plan?.sop_angle ?? null}
                    hasPlan={Boolean(plan)}
                    providers={providers}
                  />
                </div>
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
