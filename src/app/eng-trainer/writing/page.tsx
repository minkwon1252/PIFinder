import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/profile";
import { submitWriting } from "./actions";

export default async function WritingPage() {
  const session = await getSessionProfile();
  const supabase = await createClient();

  // Load all writing prompts and rotate by how many the user has done, so a new
  // prompt appears after each submission (cycling through the full set).
  const { data: sets } = await supabase
    .from("toefl_practice_sets")
    .select("title, prompt, time_limit_seconds")
    .eq("kind", "writing")
    .order("title", { ascending: true });

  const { count: writingAttempts } = await supabase
    .from("toefl_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session!.user.id);

  const total = sets?.length ?? 0;
  const set = total > 0 ? sets![(writingAttempts ?? 0) % total] : undefined;

  const { data: last } = await supabase
    .from("toefl_attempts")
    .select("score_estimate, feedback, created_at")
    .eq("user_id", session!.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-brand">Writing practice</h1>

      <div className="card mt-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{set?.title ?? "TOEFL-style prompt"}</p>
          {total > 0 && (
            <span className="text-xs text-slate-500">
              Prompt {((writingAttempts ?? 0) % total) + 1} of {total} · a new one appears after each submission
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-slate-700">{set?.prompt}</p>
      </div>

      <form action={submitWriting} className="card mt-4 space-y-3">
        <input type="hidden" name="prompt" value={set?.prompt ?? ""} />
        <textarea
          name="response"
          required
          placeholder="Write your response here…"
          className="input min-h-64"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="timed" /> Timed mode (record duration)
        </label>
        <input type="hidden" name="duration" value="0" />
        <button className="btn-primary" type="submit">
          Submit for scoring
        </button>
      </form>

      {last && (
        <div className="card mt-4">
          <h3 className="font-semibold">
            Last score: {Number(last.score_estimate ?? 0).toFixed(0)} / 30
          </h3>
          <dl className="mt-2 space-y-1 text-sm">
            {Object.entries((last.feedback as Record<string, string>) ?? {}).map(([k, v]) => (
              <div key={k}>
                <dt className="font-medium capitalize">{k}</dt>
                <dd className="text-slate-600">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </AppShell>
  );
}
