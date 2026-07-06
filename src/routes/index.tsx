import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { getCurrentUser } from "@/server/functions/auth";

export const Route = createFileRoute("/")({
  loader: async () => {
    const result = await getCurrentUser();
    return { user: result.user };
  },
  component: HomeAuthGate,
});

function HomeAuthGate() {
  const { user } = Route.useLoaderData();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!user) return;

    setCountdown(3);
    const interval = window.setInterval(() => {
      setCountdown((current) => Math.max(current - 1, 0));
    }, 1_000);
    const redirect = window.setTimeout(() => {
      void navigate({ to: "/dashboard" as never });
    }, 3_000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(redirect);
    };
  }, [navigate, user]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-paper text-ink">
      <div className="auth-gate-grid" aria-hidden="true" />
      <div className="auth-gate-radial" aria-hidden="true" />

      <header className="relative z-10 flex h-14 items-center justify-between border-b border-hairline bg-paper/80 px-6 backdrop-blur-md lg:px-8">
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
        <span className="text-ui-sm text-muted">
          Open from Merchant Dashboard
        </span>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-56px)] items-center justify-center px-5 py-10">
        <section className="w-full max-w-[460px]">
          {user ? (
            <div className="auth-gate-card">
              <div className="auth-gate-spinner mx-auto mb-7" />
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-subtle">
                Signed in
              </p>
              <h1 className="mb-3 text-[28px] font-semibold leading-[1.08] tracking-tight md:text-[32px]">
                Redirecting to Dashboard.
              </h1>
              <p className="mx-auto mb-8 max-w-sm text-ui-sm leading-relaxed text-muted md:text-[15px]">
                Your account is ready. You will be redirected in{" "}
                <span className="font-mono font-medium text-ink">{countdown}</span>{" "}
                seconds.
              </p>
              <Link
                to="/dashboard"
                className="flex h-11 items-center justify-center rounded-xl bg-ink text-ui-sm font-medium text-paper transition-colors duration-base hover:bg-ink/90"
              >
                Go now
              </Link>
            </div>
          ) : (
            <div className="auth-gate-card">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-hairline bg-chalk">
                <svg
                  aria-hidden="true"
                  className="h-6 w-6 text-ink"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </div>

              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-subtle">
                Sign-in required
              </p>
              <h1 className="mb-3 text-[28px] font-semibold leading-[1.08] tracking-tight md:text-[32px]">
                Open Cloud AI from the Merchant Dashboard.
              </h1>
              <p className="mx-auto mb-8 max-w-sm text-ui-sm leading-relaxed text-muted md:text-[15px]">
                Cloud AI is an internal builder for your Monmi store. Launch it from the Merchant Dashboard so your session carries over automatically.
              </p>
            </div>
          )}

          <p className="mt-6 text-center text-xs leading-relaxed text-subtle">
            Access is granted through the Merchant Dashboard.
          </p>
        </section>
      </main>
    </div>
  );
}
