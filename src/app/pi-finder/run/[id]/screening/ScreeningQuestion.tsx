"use client";

import { useState } from "react";
import { answerScreening } from "./actions";

/**
 * One screening question. The user can mark up to two preferences:
 *   1st pick = Preference 1 (blue), 2nd pick = Preference 2 (green).
 * Then "Save & next question" records them and advances. Not color-only:
 * selected options carry a numbered badge + aria-pressed.
 */
export function ScreeningQuestion({
  runId,
  questionKey,
  prompt,
  options,
}: {
  runId: string;
  questionKey: string;
  prompt: string;
  options: string[];
}) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(opt: string) {
    setSelected((cur) => {
      if (cur.includes(opt)) return cur.filter((o) => o !== opt); // deselect
      if (cur.length >= 2) return cur; // max two preferences
      return [...cur, opt];
    });
  }

  return (
    <div className="card mt-6">
      <p className="font-medium">{prompt}</p>
      <p className="mt-1 text-xs text-slate-500">
        Pick your top choice (turns <span className="font-semibold text-blue-600">blue</span>), and
        optionally a second (turns <span className="font-semibold text-emerald-600">green</span>).
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((opt) => {
          const idx = selected.indexOf(opt);
          const cls =
            idx === 0
              ? "border-2 border-blue-500 bg-blue-50 text-blue-700"
              : idx === 1
                ? "border-2 border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border border-slate-300 text-slate-700 hover:bg-slate-50";
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              aria-pressed={idx >= 0}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${cls}`}
            >
              {idx === 0 && <span className="mr-1 rounded-full bg-blue-600 px-1.5 text-xs text-white">1</span>}
              {idx === 1 && <span className="mr-1 rounded-full bg-emerald-600 px-1.5 text-xs text-white">2</span>}
              {opt}
            </button>
          );
        })}
      </div>

      <form action={answerScreening} className="mt-4">
        <input type="hidden" name="runId" value={runId} />
        <input type="hidden" name="questionKey" value={questionKey} />
        <input type="hidden" name="pref1" value={selected[0] ?? ""} />
        <input type="hidden" name="pref2" value={selected[1] ?? ""} />
        <button type="submit" disabled={selected.length === 0} className="btn-primary text-sm">
          Save &amp; next question →
        </button>
      </form>
    </div>
  );
}
