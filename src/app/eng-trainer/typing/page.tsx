import { AppShell } from "@/components/AppShell";
import { TypingTest } from "./TypingTest";

export default function TypingPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-brand">Typing practice</h1>
      <p className="mt-1 text-sm text-slate-600">
        Type the academic passage. We measure words-per-minute and accuracy and save your attempt.
      </p>
      <div className="mt-4">
        <TypingTest />
      </div>
    </AppShell>
  );
}
