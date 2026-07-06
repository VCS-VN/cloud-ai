import { useState } from 'react'
import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { AlertTriangle, ChevronDown, Home, RotateCw } from 'lucide-react'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'An unexpected error occurred.'
}

function getErrorStack(error: unknown): string | null {
  if (error instanceof Error && error.stack) return error.stack
  return null
}

export function AppErrorFallback({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const message = getErrorMessage(error)
  const stack = getErrorStack(error)

  async function handleRetry() {
    if (retrying) return
    setRetrying(true)
    try {
      reset()
      await router.invalidate()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="notfound-grid-bg flex min-h-[100dvh] flex-col bg-paper font-sans text-ink">
      <nav className="shrink-0 border-b border-hairline bg-paper/80 backdrop-blur-md">
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
          <Link to="/" className="text-ui-sm text-muted transition-colors duration-base hover:text-ink">
            Sign in
          </Link>
        </div>
      </nav>

      <main className="flex flex-1 items-center justify-center px-6 py-14">
        <section className="w-full max-w-[640px] animate-[notfound-fade-in_0.45s_ease-out] text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-danger-fg/25 bg-danger-bg px-3 py-1 text-eyebrow font-medium uppercase tracking-wide text-danger-fg">
            <span className="h-1.5 w-1.5 rounded-full bg-danger-dot" aria-hidden="true" />
            Something broke
          </div>

          <div className="notfound-card-shadow rounded-[28px] border border-hairline bg-surface px-8 py-10 md:px-12 md:py-12">
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-danger-fg/25 bg-danger-bg">
              <AlertTriangle aria-hidden="true" size={30} className="text-danger-fg" strokeWidth={2} />
            </div>

            <h1 className="mb-4 font-display text-[38px] font-semibold leading-[1.05] tracking-[-0.04em] md:text-[48px]">
              This screen ran into a problem.
            </h1>
            <p className="mx-auto mb-8 max-w-[480px] text-[15px] leading-relaxed text-muted md:text-[16px]">
              The page failed to load. Retrying often clears it. If the problem keeps happening, head back to
              your dashboard and try again from there.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void handleRetry()}
                disabled={retrying}
                className="focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-body font-medium text-paper transition-[background-color,transform] duration-base hover:bg-deep active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <RotateCw
                  aria-hidden="true"
                  size={16}
                  className={retrying ? 'animate-spin' : undefined}
                />
                {retrying ? 'Retrying...' : 'Try again'}
              </button>
              <Link
                to="/dashboard"
                className="focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-hairline bg-surface px-5 text-body font-medium text-ink transition-colors duration-base hover:bg-chalk sm:w-auto"
              >
                <Home aria-hidden="true" size={16} />
                Go to Dashboard
              </Link>
            </div>

            {message ? (
              <div className="mt-8 text-left">
                <button
                  type="button"
                  onClick={() => setDetailsOpen((open) => !open)}
                  aria-expanded={detailsOpen}
                  className="focus-ring flex w-full items-center justify-between gap-2 rounded-lg border border-hairline bg-chalk/60 px-3 py-2 text-ui-sm font-medium text-muted transition-colors duration-base hover:text-ink"
                >
                  <span className="min-w-0 truncate">Error details</span>
                  <ChevronDown
                    aria-hidden="true"
                    size={16}
                    className={`shrink-0 transition-transform duration-base ${detailsOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {detailsOpen ? (
                  <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-hairline bg-chalk px-3 py-3 text-left font-mono text-[12px] leading-relaxed text-muted">
                    {stack ?? message}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="shrink-0 border-t border-hairline">
        <div className="mx-auto flex h-14 max-w-container items-center justify-between px-6 text-caption text-muted lg:px-8">
          <span>© 2026 Cloud AI</span>
          <div className="flex items-center gap-4">
            <span>System status</span>
            <span>Support</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
