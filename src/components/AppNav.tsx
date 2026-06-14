import Link from "next/link";
import { signOut } from "@/app/login/actions";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pi-finder", label: "PI Finder" },
  { href: "/shortlist", label: "Shortlist" },
  { href: "/story-builder", label: "Story" },
  { href: "/eng-trainer", label: "ENG Trainer" },
  { href: "/secretary", label: "Secretary" },
  { href: "/profile", label: "Profile" },
];

export function AppNav({ isAdmin }: { isAdmin?: boolean }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="text-lg font-bold text-brand">
          PI<span className="text-brand-accent">Finder</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {n.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded px-2 py-1 font-medium text-purple-700 hover:bg-purple-50"
            >
              Admin
            </Link>
          )}
          <form action={signOut}>
            <button className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100" type="submit">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
