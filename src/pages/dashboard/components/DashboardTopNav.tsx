import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";

export function DashboardTopNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-hairline bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-7">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-paper">
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M4 7h16M4 12h16M4 17h10" />
              </svg>
            </span>
            <span className="font-semibold tracking-tight">Cloud AI</span>
          </Link>
          <div className="hidden items-center gap-1 text-ui-sm lg:flex">
            <Link
              to="/dashboard"
              className="rounded-md bg-ink/[0.04] px-3 py-1.5 font-medium text-ink"
            >
              Projects
            </Link>
            <a
              href="#"
              className="rounded-md px-3 py-1.5 text-muted hover:bg-ink/[0.04] hover:text-ink"
            >
              Docs
            </a>
          </div>
        </div>
        <div className="hidden h-9 w-72 items-center gap-2 rounded-lg border border-hairline bg-surface px-3 md:flex">
          <Search aria-hidden="true" className="text-subtle" size={16} />
          <input
            className="flex-1 bg-transparent text-ui-sm outline-none placeholder:text-subtle"
            placeholder="Search projects, templates..."
          />
          <kbd className="rounded bg-ink/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-subtle">
            ⌘K
          </kbd>
        </div>
      </div>
    </nav>
  );
}
