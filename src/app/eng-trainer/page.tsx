import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/profile";

export default async function EngTrainerPage() {
  const session = await getSessionProfile();
  const supabase = await createClient();

  const { data: attempts } = await supabase
    .from("toefl_attempts")
    .select("score_estimate, created_at")
    .eq("user_id", session!.user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const avg =
    attempts && attempts.length
      ? (
          attempts.reduce((s, a) => s + Number(a.score_estimate ?? 0), 0) / attempts.length
        ).toFixed(1)
      : "—";

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-brand">ENG Trainer</h1>
      <p className="mt-1 text-sm text-slate-600">
        TOEFL-style writing practice and English typing drills.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Link href="/eng-trainer/writing" className="card hover:border-brand-accent">
          <h3 className="font-semibold">Writing practice →</h3>
          <p className="mt-1 text-sm text-slate-600">
            Timed/untimed TOEFL prompts with scored feedback on structure, grammar, clarity,
            tone, vocabulary, and argument.
          </p>
        </Link>
        <Link href="/eng-trainer/typing" className="card hover:border-brand-accent">
          <h3 className="font-semibold">Typing practice →</h3>
          <p className="mt-1 text-sm text-slate-600">Measure WPM and accuracy on academic text.</p>
        </Link>
      </div>

      <div className="card mt-6">
        <h3 className="font-semibold">Progress</h3>
        <p className="mt-1 text-sm text-slate-600">
          Average writing score (last {attempts?.length ?? 0}): <strong>{avg}</strong> / 30
        </p>
        <div className="mt-3 flex items-end gap-1">
          {(attempts ?? []).slice().reverse().map((a, i) => (
            <div
              key={i}
              title={`${a.score_estimate ?? 0}/30`}
              className="w-6 rounded-t bg-brand-accent"
              style={{ height: `${(Number(a.score_estimate ?? 0) / 30) * 80 + 4}px` }}
            />
          ))}
          {(!attempts || attempts.length === 0) && (
            <span className="text-sm text-slate-400">No attempts yet.</span>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-500">
        Speaking practice (audio recording, transcription, timing) is planned for a later phase.
      </p>
    </AppShell>
  );
}
