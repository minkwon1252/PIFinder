import { AppShell } from "@/components/AppShell";
import { startPiFinderRun } from "./actions";
import { RunButton } from "./RunButton";

export default async function PiFinderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; used?: string; limit?: string }>;
}) {
  const sp = await searchParams;

  const errorMsg =
    sp.error === "rate_limited"
      ? `Daily run limit reached (${sp.used}/${sp.limit}). Try again tomorrow.`
      : sp.error === "no_targets"
        ? "Add target schools in your profile before running PI Finder."
        : sp.error
          ? "Could not start the run. Please try again."
          : null;

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-brand">PI Finder</h1>
      <p className="mt-1 text-sm text-slate-600">
        Finds optimal professors using your research profile, CV, keywords, and target schools.
      </p>

      {errorMsg && (
        <div className="card mt-4 border-red-200 bg-red-50 text-sm text-red-700">{errorMsg}</div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <form action={startPiFinderRun} className="card">
          <input type="hidden" name="mode" value="department_list" />
          <h3 className="font-semibold">Mode A · Department list</h3>
          <p className="mt-1 text-sm text-slate-600">
            For each school and each relevant department, recommend three professors. Departments
            expand by tier (Reach = broad, Foundation = focused).
          </p>
          <RunButton label="Run department list" />
        </form>

        <form action={startPiFinderRun} className="card">
          <input type="hidden" name="mode" value="ultimate_match" />
          <h3 className="font-semibold">Mode B · Ultimate match</h3>
          <p className="mt-1 text-sm text-slate-600">
            Recommend the single strongest professor match per school.
          </p>
          <RunButton label="Run ultimate match" />
        </form>
      </div>

      <p className="mt-6 text-xs text-slate-500">
        Professor data is real, sourced from OpenAlex and official department pages with provenance.
        Department attribution is being refined; verify details before contacting anyone.
      </p>
    </AppShell>
  );
}
