"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveOnboarding } from "./actions";
import { createClient } from "@/lib/supabase/client";

const DEPT_OPTIONS = [
  "MSE", "EE", "ME", "ChemE", "BME", "NucE", "CS", "AP", "PHYS", "CHEM", "MATH",
  "AeroE", "CEE", "ISE",
];

export interface OnboardingInitial {
  major1: string;
  major2: string;
  targetDegree: string;
  interests: string[];
  method: string;
  applicationArea: string;
  projectSummary: string;
  tierMap: Record<string, string>;
}

export function OnboardingForm({
  schools,
  userId,
  initial = null,
  isEdit = false,
}: {
  schools: { id: string; name: string }[];
  userId: string;
  initial?: OnboardingInitial | null;
  isEdit?: boolean;
}) {
  const router = useRouter();
  const [major1, setMajor1] = useState(initial?.major1 ?? "MSE");
  const [major2, setMajor2] = useState(initial?.major2 ?? "");
  const [targetDegree, setTargetDegree] = useState(initial?.targetDegree ?? "undecided");
  const [interests, setInterests] = useState<string[]>(
    initial?.interests ?? ["", "", ""],
  );
  const [method, setMethod] = useState(initial?.method ?? "unknown");
  const [applicationArea, setApplicationArea] = useState(initial?.applicationArea ?? "");
  const [projectSummary, setProjectSummary] = useState(initial?.projectSummary ?? "");
  const [tierMap, setTierMap] = useState<Record<string, string>>(initial?.tierMap ?? {});
  const [cv, setCv] = useState<File | null>(null);
  const [story, setStory] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setSchoolTier(name: string, tier: string) {
    setTierMap((m) => ({ ...m, [name]: tier }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      let cvPath: string | null = null;
      let cvName: string | null = null;
      if (cv) {
        const path = `${userId}/cv-${Date.now()}-${cv.name}`;
        const { error: upErr } = await supabase.storage.from("cvs").upload(path, cv, { upsert: false });
        if (upErr) throw new Error(`CV upload failed: ${upErr.message}`);
        cvPath = path;
        cvName = cv.name;
      }

      // Optional second "story" file (statement, portfolio, anything).
      let storyPath: string | null = null;
      let storyName: string | null = null;
      if (story) {
        const path = `${userId}/story-${Date.now()}-${story.name}`;
        const { error: upErr } = await supabase.storage.from("cvs").upload(path, story, { upsert: false });
        if (upErr) throw new Error(`Story file upload failed: ${upErr.message}`);
        storyPath = path;
        storyName = story.name;
      }

      const reach = Object.entries(tierMap).filter(([, t]) => t === "reach").map(([n]) => n);
      const target = Object.entries(tierMap).filter(([, t]) => t === "target").map(([n]) => n);
      const foundation = Object.entries(tierMap).filter(([, t]) => t === "foundation").map(([n]) => n);

      const res = await saveOnboarding({
        major1,
        major2: major2 || null,
        targetDegree,
        interests: interests.map((i) => i.trim()).filter(Boolean),
        method,
        applicationArea: applicationArea || null,
        projectSummary: projectSummary || null,
        reach,
        target,
        foundation,
        cvPath,
        cvName,
        storyPath,
        storyName,
      });
      if (res?.error) {
        setError(res.error);
        setBusy(false);
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Major 1 (primary)</label>
          <select className="input" value={major1} onChange={(e) => setMajor1(e.target.value)}>
            {DEPT_OPTIONS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Major 2 (optional)</label>
          <select className="input" value={major2} onChange={(e) => setMajor2(e.target.value)}>
            <option value="">— none —</option>
            {DEPT_OPTIONS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Target degree</label>
          <select
            className="input"
            value={targetDegree}
            onChange={(e) => setTargetDegree(e.target.value)}
          >
            <option value="MS">MS</option>
            <option value="PhD">PhD</option>
            <option value="MS_PhD">MS/PhD</option>
            <option value="undecided">Undecided</option>
          </select>
        </div>
        <div>
          <label className="label">Research method preference</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="experimental">Experimental</option>
            <option value="computational">Computational</option>
            <option value="theoretical">Theoretical</option>
            <option value="mixed">Mixed</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label">Research interest keywords (2–3)</label>
        <div className="grid gap-2 sm:grid-cols-3">
          {interests.map((v, i) => (
            <input
              key={i}
              className="input"
              placeholder={`keyword ${i + 1}`}
              value={v}
              onChange={(e) =>
                setInterests((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))
              }
            />
          ))}
        </div>
      </div>

      <div>
        <label className="label">Preferred application area</label>
        <input
          className="input"
          placeholder="e.g. solid-state batteries"
          value={applicationArea}
          onChange={(e) => setApplicationArea(e.target.value)}
        />
      </div>

      <div>
        <label className="label">Project / research summary (optional)</label>
        <textarea
          className="input min-h-24"
          value={projectSummary}
          onChange={(e) => setProjectSummary(e.target.value)}
        />
      </div>

      <div>
        <label className="label">Target schools — tag each as Reach / Target / Foundation</label>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {schools.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{s.name}</span>
              <select
                className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                value={tierMap[s.name] ?? ""}
                onChange={(e) => setSchoolTier(s.name, e.target.value)}
              >
                <option value="">—</option>
                <option value="reach">Reach</option>
                <option value="target">Target</option>
                <option value="foundation">Foundation</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Upload CV (PDF, private)</label>
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={(e) => setCv(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <p className="mt-1 text-xs text-slate-500">
          Stored in a private bucket; only you and admins can access it.
          {isEdit && " Leave empty to keep your current CV."}
        </p>
      </div>

      <div>
        <label className="label">Your &ldquo;story&rdquo; file (optional)</label>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt,.md"
          onChange={(e) => setStory(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <p className="mt-1 text-xs text-slate-500">
          Anything that explains your background, goals, and what you dream of doing — a statement of
          purpose draft, research summary, or portfolio. Helps tailor your fit and story. Also private.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary">
        {busy ? "Saving…" : isEdit ? "Save changes" : "Save research profile"}
      </button>
    </form>
  );
}
