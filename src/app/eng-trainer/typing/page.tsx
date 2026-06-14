import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { TypingTest } from "./TypingTest";

export default async function TypingPage() {
  const supabase = await createClient();
  // Passages are seeded as toefl_practice_sets of kind 'typing' (prompt = passage).
  const { data: sets } = await supabase
    .from("toefl_practice_sets")
    .select("prompt")
    .eq("kind", "typing")
    .order("title", { ascending: true });
  const passages = (sets ?? []).map((s) => s.prompt).filter(Boolean) as string[];

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-brand">Typing practice</h1>
      <p className="mt-1 text-sm text-slate-600">
        Type the academic passage. We measure words-per-minute and accuracy and save your attempt.
        A new passage loads after each one.
      </p>
      <div className="mt-4">
        <TypingTest passages={passages} />
      </div>
    </AppShell>
  );
}
