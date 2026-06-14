"use client";

import { useMemo, useRef, useState } from "react";
import { saveTypingAttempt } from "./actions";

const FALLBACK = [
  "Graduate research requires persistence, clear writing, and the ability to read scientific literature critically. A strong statement of purpose connects your past projects to a professor's current work.",
];

export function TypingTest({ passages }: { passages: string[] }) {
  const pool = passages.length > 0 ? passages : FALLBACK;
  // Start at a random passage so repeat visits differ.
  const [index, setIndex] = useState(() => Math.floor(Math.random() * pool.length));
  const sample = pool[index % pool.length] ?? FALLBACK[0]!;

  const [value, setValue] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [result, setResult] = useState<{ wpm: number; accuracy: number; seconds: number } | null>(
    null,
  );
  const saved = useRef(false);

  const correctChars = useMemo(() => {
    let n = 0;
    for (let i = 0; i < value.length; i++) if (value[i] === sample[i]) n++;
    return n;
  }, [value, sample]);

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    if (!startedAt && v.length > 0) setStartedAt(Date.now());
    setValue(v);

    if (v.length >= sample.length && startedAt) {
      const seconds = (Date.now() - startedAt) / 1000;
      const words = sample.split(/\s+/).length;
      const wpm = Math.round((words / seconds) * 60);
      const accuracy = Math.round((correctChars / sample.length) * 1000) / 10;
      const r = { wpm, accuracy, seconds: Math.round(seconds) };
      setResult(r);
      if (!saved.current) {
        saved.current = true;
        void saveTypingAttempt({ wpm, accuracy, durationSeconds: r.seconds, sampleText: sample });
      }
    }
  }

  // Advance to the next passage (new sentence) and reset the test.
  function nextPassage() {
    setIndex((i) => (i + 1) % pool.length);
    setValue("");
    setStartedAt(null);
    setResult(null);
    saved.current = false;
  }

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Passage {(index % pool.length) + 1} of {pool.length}
        </span>
        {!result && (
          <button onClick={nextPassage} className="btn-ghost text-xs" type="button">
            Skip / new passage
          </button>
        )}
      </div>
      <p className="rounded bg-slate-50 p-3 font-mono text-sm leading-relaxed text-slate-700">
        {sample.split("").map((ch, i) => {
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
          <button onClick={nextPassage} className="btn-primary text-xs" type="button">
            Next passage →
          </button>
        </div>
      )}
    </div>
  );
}
