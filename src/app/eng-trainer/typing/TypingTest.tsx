"use client";

import { useMemo, useRef, useState } from "react";
import { saveTypingAttempt } from "./actions";

const SAMPLE =
  "Graduate research requires persistence, clear writing, and the ability to read scientific literature critically. A strong statement of purpose connects your past projects to a professor's current work.";

export function TypingTest() {
  const [value, setValue] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [result, setResult] = useState<{ wpm: number; accuracy: number; seconds: number } | null>(
    null,
  );
  const saved = useRef(false);

  const correctChars = useMemo(() => {
    let n = 0;
    for (let i = 0; i < value.length; i++) if (value[i] === SAMPLE[i]) n++;
    return n;
  }, [value]);

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    if (!startedAt && v.length > 0) setStartedAt(Date.now());
    setValue(v);

    if (v.length >= SAMPLE.length && startedAt) {
      const seconds = (Date.now() - startedAt) / 1000;
      const words = SAMPLE.split(/\s+/).length;
      const wpm = Math.round((words / seconds) * 60);
      const accuracy = Math.round((correctChars / SAMPLE.length) * 1000) / 10;
      const r = { wpm, accuracy, seconds: Math.round(seconds) };
      setResult(r);
      if (!saved.current) {
        saved.current = true;
        void saveTypingAttempt({
          wpm,
          accuracy,
          durationSeconds: r.seconds,
          sampleText: SAMPLE,
        });
      }
    }
  }

  function reset() {
    setValue("");
    setStartedAt(null);
    setResult(null);
    saved.current = false;
  }

  return (
    <div className="card">
      <p className="rounded bg-slate-50 p-3 font-mono text-sm leading-relaxed text-slate-700">
        {SAMPLE.split("").map((ch, i) => {
          const typed = value[i];
          const cls =
            typed == null ? "text-slate-400" : typed === ch ? "text-emerald-600" : "bg-red-100 text-red-700";
          return (
            <span key={i} className={cls}>
              {ch}
            </span>
          );
        })}
      </p>
      <textarea
        value={value}
        onChange={onChange}
        disabled={!!result}
        placeholder="Start typing the text above…"
        className="input mt-3 min-h-24 font-mono"
      />
      {result && (
        <div className="mt-3 flex items-center gap-6 text-sm">
          <span>
            <strong>{result.wpm}</strong> WPM
          </span>
          <span>
            <strong>{result.accuracy}</strong>% accuracy
          </span>
          <span>{result.seconds}s</span>
          <button onClick={reset} className="btn-ghost text-xs">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
