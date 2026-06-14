import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { answerScreening } from "./actions";

export default async function ScreeningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: questions } = await supabase
    .from("screening_questions")
    .select("key, prompt, options")
    .eq("active", true);

  const { data: answered } = await supabase
    .from("screening_answers")
    .select("question_key, answer, effect_note")
    .eq("search_run_id", id);

  const answeredKeys = new Set((answered ?? []).map((a) => a.question_key));
  const remaining = (questions ?? []).filter((q) => !answeredKeys.has(q.key));
  const current = remaining[0];

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-brand">Interactive screening</h1>
      <p className="mt-1 text-sm text-slate-600">
        Answer discriminating questions to narrow your candidates. We explain what changes after
        each answer.
      </p>

      {current ? (
        <div className="card mt-6">
          <p className="font-medium">{current.prompt}</p>
          <form action={answerScreening} className="mt-4 flex flex-wrap gap-2">
            <input type="hidden" name="runId" value={id} />
            <input type="hidden" name="questionKey" value={current.key} />
            {(current.options as string[]).map((opt) => (
              <button key={opt} name="answer" value={opt} className="btn-ghost text-sm" type="submit">
                {opt}
              </button>
            ))}
          </form>
        </div>
      ) : (
        <div className="card mt-6 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-800">
            All screening questions answered. Review your refined ranking.
          </p>
          <Link href={`/pi-finder/run/${id}`} className="btn-primary mt-3">
            Back to results
          </Link>
        </div>
      )}

      {answered && answered.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold">What changed</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {answered.map((a, i) => (
              <li key={i} className="card">
                <span className="font-medium">{a.answer}</span>
                <p className="mt-1 text-slate-600">{a.effect_note}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}
