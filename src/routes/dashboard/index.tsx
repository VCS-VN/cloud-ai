import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { UserMenu } from '@/components/auth/UserMenu'
import { getCurrentUser } from '@/server/functions/auth'

export const Route = createFileRoute('/dashboard/')({
  beforeLoad: async () => {
    const { user } = await getCurrentUser()
    if (!user) throw redirect({ to: '/' })
    return { user }
  },
  component: RouteComponent
})

function RouteComponent() {
  const navigate = useNavigate()
  const { user } = Route.useRouteContext()
  return (
    <main className="min-h-screen bg-[var(--app-bg)] p-md text-[var(--app-text)]">
      <section className="mx-auto max-w-4xl rounded-sm border border-[var(--app-border)] bg-[var(--app-panel)] p-lg">
        <div className="flex items-center justify-between gap-md">
          <div>
            <p className="m-0 text-[11px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Dashboard</p>
            <h1 className="m-0 mt-xs text-[22px] font-[620] tracking-[-0.02em]">Account overview</h1>
            <p className="m-0 mt-xs text-[12px] text-[var(--app-muted)]">You are signed in as {user.email}.</p>
          </div>
          <UserMenu user={user} />
        </div>
        <button className="builder-button mt-lg bg-[var(--app-text)] text-[var(--app-bg)]" type="button" onClick={() => void navigate({ to: '/projects' as never })}>Open Projects</button>
      </section>
    </main>
  )
}
