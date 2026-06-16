"use client";

import Link from "next/link";
import { setPreference } from "./actions";
import { addToShortlist, eliminateCandidate } from "@/app/shortlist/actions";

interface Candidate {
  id: string;
  professor_id: string;
  total_score: number;
  mismatch_risk: string | null;
  preference_rank: number | null;
  fit_reason?: string | null;
  professors?: { full_name?: string; research_identity?: string } | null;
  departments?: { abbrev?: string } | null;
}

interface Scores {
  keyword_fit: number;
  method_fit: number;
  application_domain_fit: number;
  publication_recency: number;
  project_overlap: number;
  dept_school_match: number;
  lab_activity: number;
  mentorship_proxy: number;
}

const FIT_LABELS: { key: keyof Scores; label: string }[] = [
  { key: "keyword_fit", label: "Keyword overlap" },
  { key: "project_overlap", label: "Your projects ↔ lab" },
  { key: "application_domain_fit", label: "Application area" },
  { key: "method_fit", label: "Research method" },
  { key: "publication_recency", label: "Recent activity" },
  { key: "dept_school_match", label: "Your department" },
];

function FitBreakdown({ scores }: { scores: Scores }) {
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <p className="text-xs font-semibold text-slate-600">How you connect</p>
      <div className="mt-2 space-y-1.5">
        {FIT_LABELS.map(({ key, label }) => {
          const v = Math.max(0, Math.min(1, Number(scores[key] ?? 0)));
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-[11px] text-slate-500">{label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-accent" style={{ width: `${Math.round(v * 100)}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right text-[11px] text-slate-500">{Math.round(v * 100)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Result card with strongly-visible preference selection (Issue 3).
 * Preference 1 = blue, Preference 2 = green. Not color-only: each selected card
 * shows a labeled badge + thick colored border/ring, and the active button is
 * marked with aria-pressed for assistive tech.
 */
export function CandidateCard({
  candidate,
  runId,
  scores = null,
  showBreakdown = false,
}: {
  candidate: Candidate;
  runId: string;
  scores?: Scores | null;
  showBreakdown?: boolean;
}) {
  const pref = candidate.preference_rank;
  const cardClass =
    pref === 1
      ? "card border-2 border-blue-500 bg-blue-50 ring-2 ring-blue-300"
      : pref === 2
        ? "card border-2 border-emerald-500 bg-emerald-50 ring-2 ring-emerald-300"
        : "card";

  return (
    <div className={cardClass} aria-label={pref ? `Preference ${pref}` : undefined}>
      {pref && (
        <span
          className={`mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-white ${
            pref === 1 ? "bg-blue-600" : "bg-emerald-600"
          }`}
        >
          ★ Preference {pref}
        </span>
      )}

      <div className="flex items-start justify-between">
        <Link href={`/professors/${candidate.professor_id}`} className="font-medium text-brand-accent">
          {candidate.professors?.full_name}
        </Link>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold">
          {Number(candidate.total_score).toFixed(1)}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{candidate.departments?.abbrev}</p>
      <p className="mt-2 line-clamp-3 text-sm text-slate-600">{candidate.professors?.research_identity}</p>
      {candidate.mismatch_risk && (
        <p className="mt-2 text-xs text-amber-700">⚠ {candidate.mismatch_risk}</p>
      )}

      {/* "How you connect" fit breakdown — always shown for ultimate match. */}
      {scores && (showBreakdown || candidate.preference_rank != null) && <FitBreakdown scores={scores} />}

      {/* Preference controls */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <PrefButton runId={runId} candidateId={candidate.id} rank={1} active={pref === 1} />
        <PrefButton runId={runId} candidateId={candidate.id} rank={2} active={pref === 2} />
        {pref != null && (
          <form action={setPreference}>
            <input type="hidden" name="runId" value={runId} />
            <input type="hidden" name="candidateId" value={candidate.id} />
            <input type="hidden" name="rank" value={0} />
            <button className="btn-ghost text-xs text-slate-500" type="submit">
              Clear
            </button>
          </form>
        )}
      </div>

      {/* Shortlist controls */}
      <div className="mt-2 flex gap-2 border-t border-slate-100 pt-2">
        <form action={addToShortlist}>
          <input type="hidden" name="candidateId" value={candidate.id} />
          <button className="btn-ghost text-xs" type="submit">Save</button>
        </form>
        <form action={eliminateCandidate}>
          <input type="hidden" name="candidateId" value={candidate.id} />
          <button className="btn-ghost text-xs text-slate-500" type="submit">Eliminate</button>
        </form>
      </div>
    </div>
  );
}

function PrefButton({
  runId,
  candidateId,
  rank,
  active,
}: {
  runId: string;
  candidateId: string;
  rank: 1 | 2;
  active: boolean;
}) {
  const color = rank === 1 ? "blue" : "emerald";
  const activeCls = rank === 1 ? "bg-blue-600 text-white" : "bg-emerald-600 text-white";
  const idleCls =
    rank === 1
      ? "border border-blue-300 text-blue-700 hover:bg-blue-50"
      : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50";
  return (
    <form action={setPreference}>
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="rank" value={rank} />
      <button
        type="submit"
        aria-pressed={active}
        title={`Set as Preference ${rank}`}
        className={`rounded px-2 py-0.5 text-xs font-medium ${active ? activeCls : idleCls}`}
        data-color={color}
      >
        {active ? `● Preference ${rank}` : `Set Preference ${rank}`}
      </button>
    </form>
  );
}
