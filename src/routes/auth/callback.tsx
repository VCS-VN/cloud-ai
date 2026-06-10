import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/callback")({
  component: CallbackRoute,
});

function CallbackRoute() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.href = `/api/auth/callback${window.location.search}`;
    }, 350);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-paper text-ink font-sans callback-grid-bg">
      <nav className="border-b border-hairline bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-container items-center justify-between px-6 lg:px-8">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink">
              <svg
                className="h-3.5 w-3.5 text-paper"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path d="M4 7h16M4 12h16M4 17h10" />
              </svg>
            </span>
            <span className="font-semibold tracking-tight">Cloud AI</span>
          </Link>
          <div className="font-mono text-eyebrow uppercase tracking-wide text-muted">
            Authenticating
          </div>
        </div>
      </nav>

      <main className="flex min-h-[calc(100vh-7rem)] items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px] animate-[callback-fade-in_0.4s_ease-out] text-center">
          <div className="mb-8 flex justify-center">
            <div className="callback-spinner" aria-hidden="true" />
          </div>
          <h1 className="mb-3 font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em]">
            Authenticating with Monmi
          </h1>
          <p className="mx-auto mb-6 max-w-[320px] text-body leading-relaxed text-muted">
            Don't close this tab — the process takes about 2-3 seconds.
          </p>
          <div className="inline-flex items-center gap-1.5" aria-hidden="true">
            <span className="callback-pulse-dot" />
            <span className="callback-pulse-dot" />
            <span className="callback-pulse-dot" />
          </div>

          <div className="mt-10">
            <Link
              to="/"
              className="text-caption text-muted underline decoration-hairline underline-offset-2 transition-colors duration-base hover:text-ink hover:decoration-ink"
            >
              Cancel and go back to sign in
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex h-14 max-w-container items-center justify-between px-6 text-caption text-muted lg:px-8">
          <div className="flex items-center gap-4">
            <span>© 2026 Cloud AI</span>
            <span className="text-subtle" aria-hidden="true">·</span>
            <span>System status</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Support</span>
            <span className="hidden text-subtle md:inline">EN</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
