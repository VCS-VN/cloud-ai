import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HeadContent, Link, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { ThemeProvider } from '@/theme'
import '@app/styles/index.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Cloud AI' },
      { name: 'theme-color', content: '#ffffff', media: '(prefers-color-scheme: light)' },
      { name: 'theme-color', content: '#000000', media: '(prefers-color-scheme: dark)' },
      { name: 'application-name', content: 'Cloud AI' },
      { name: 'apple-mobile-web-app-title', content: 'Cloud AI' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
    ]
  }),
  component: RootComponent,
  notFoundComponent: NotFoundPage
})

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Outlet />
        </ThemeProvider>
      </QueryClientProvider>
    </RootDocument>
  )
}

function NotFoundPage() {
  return (
    <div className="notfound-grid-bg flex min-h-screen flex-col bg-paper text-ink font-sans">
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
        <section className="w-full max-w-[760px] animate-[notfound-fade-in_0.45s_ease-out] text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1 text-eyebrow font-medium uppercase tracking-wide text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-warning-dot" aria-hidden="true" />
            Not found
          </div>

          <div className="notfound-card-shadow rounded-[28px] border border-hairline bg-surface px-8 py-10 md:px-12 md:py-12">
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-hairline bg-chalk">
              <span className="font-mono text-[28px] font-semibold tracking-[-0.08em]">404</span>
            </div>

            <h1 className="mb-4 font-display text-[44px] font-semibold leading-[1.03] tracking-[-0.04em] md:text-[56px]">
              This page does not exist.
            </h1>
            <p className="mx-auto mb-8 max-w-[520px] text-[15px] leading-relaxed text-muted md:text-[16px]">
              The link may have changed, the project may have been deleted, or you may not have access to this workspace.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/dashboard"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-body font-medium text-paper transition-colors duration-base hover:bg-ink/90 sm:w-auto"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path d="M3 12h18" />
                  <path d="M12 3l9 9-9 9" />
                </svg>
                Go to Dashboard
              </Link>
              <Link
                to="/"
                className="flex h-11 w-full items-center justify-center rounded-xl border border-hairline bg-surface px-5 text-body font-medium text-ink transition-colors duration-base hover:bg-chalk sm:w-auto"
              >
                Sign in again
              </Link>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
            <Link to="/dashboard" className="group rounded-2xl border border-hairline bg-surface/70 p-4 transition-colors duration-base hover:bg-surface">
              <div className="mb-1 text-ui-sm font-medium underline-offset-4 group-hover:underline">Project list</div>
              <div className="text-caption leading-relaxed text-muted">Open your generated website list.</div>
            </Link>
            <Link to="/" className="group rounded-2xl border border-hairline bg-surface/70 p-4 transition-colors duration-base hover:bg-surface">
              <div className="mb-1 text-ui-sm font-medium underline-offset-4 group-hover:underline">Create a new project</div>
              <div className="text-caption leading-relaxed text-muted">Start with your first prompt.</div>
            </Link>
            <Link to="/settings" className="group rounded-2xl border border-hairline bg-surface/70 p-4 transition-colors duration-base hover:bg-surface">
              <div className="mb-1 text-ui-sm font-medium underline-offset-4 group-hover:underline">Settings</div>
              <div className="text-caption leading-relaxed text-muted">Check workspace, billing, and access.</div>
            </Link>
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

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
