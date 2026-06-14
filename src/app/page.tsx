import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-accent">
        STEM · SNU Tomorrow&apos;s Edge Membership
      </p>
      <h1 className="text-5xl font-bold text-brand">PIFinder</h1>
      <p className="mt-4 text-xl text-slate-600">
        Find your PI. Build your story. Manage your application.
      </p>
      <p className="mt-6 max-w-2xl text-slate-600">
        A graduate-school application copilot for SNU engineering students applying to US
        programs. PIFinder finds the optimal professors for your research profile, helps you
        build an honest application story, and tracks every deadline.
      </p>

      <div className="mt-8 flex gap-3">
        <Link href="/login" className="btn-primary">
          STEM member sign in
        </Link>
        <a href="#features" className="btn-ghost">
          Learn more
        </a>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Access is limited to verified STEM members with an <code>@snu.ac.kr</code> email on the
        member allowlist.
      </p>

      <section id="features" className="mt-16 grid gap-4 sm:grid-cols-3">
        {[
          ["PI Finder", "Optimal professor matches by department and an ultimate match per school, with evidence."],
          ["ENG Trainer", "TOEFL-style writing practice with scored feedback and typing drills."],
          ["Secretary", "Deadline tracking sourced from official admissions pages."],
        ].map(([title, body]) => (
          <div key={title} className="card">
            <h3 className="font-semibold text-brand">{title}</h3>
            <p className="mt-2 text-sm text-slate-600">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
