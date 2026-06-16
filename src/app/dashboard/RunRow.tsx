"use client";

import Link from "next/link";
import { useState } from "react";
import { renameRun, deleteRun } from "./actions";

export interface RunRowData {
  id: string;
  mode: string;
  status: string;
  nickname: string | null;
  created_at: string;
}

function modeLabel(mode: string): string {
  if (mode === "ultimate_match") return "Ultimate match";
  if (mode === "manual_search") return "Manual search";
  return "Department list";
}

/** A recent-run row with inline rename and confirmed delete (Issue 5). */
export function RunRow({ run }: { run: RunRowData }) {
  const [editing, setEditing] = useState(false);
  const label = modeLabel(run.mode);
  const title = run.nickname
    ? `${run.nickname} / ${label}`
    : `${label} · ${new Date(run.created_at).toLocaleDateString()}`;

  if (editing) {
    return (
      <li>
        <form action={renameRun} className="flex items-center gap-2" onSubmit={() => setEditing(false)}>
          <input type="hidden" name="runId" value={run.id} />
          <input
            name="nickname"
            defaultValue={run.nickname ?? ""}
            required
            maxLength={80}
            placeholder="e.g. MIT biomaterials search"
            className="input flex-1 py-1 text-sm"
            autoFocus
          />
          <button className="btn-ghost text-xs" type="submit">Save</button>
          <button type="button" className="btn-ghost text-xs text-slate-500" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2">
      <Link href={`/pi-finder/run/${run.id}`} className="truncate text-brand-accent">
        {title}
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-slate-500">{run.status}</span>
        <button type="button" className="btn-ghost text-xs" onClick={() => setEditing(true)}>
          Rename
        </button>
        <form
          action={deleteRun}
          onSubmit={(e) => {
            if (
              !confirm(
                "Delete this run and its results? Saved professors and stories from this run will also be removed.",
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="runId" value={run.id} />
          <button className="btn-ghost text-xs text-red-600" type="submit">
            Delete
          </button>
        </form>
      </div>
    </li>
  );
}
