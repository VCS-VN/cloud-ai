import { createFileRoute, redirect } from '@tanstack/react-router'
import { UserMenu } from '@/components/auth/UserMenu'
import { getCurrentUser } from '@/server/functions/auth'

export const Route = createFileRoute('/settings/profile')({
  beforeLoad: async () => {
    const { user } = await getCurrentUser()
    if (!user) throw redirect({ to: '/' })
    return { user }
  },
  component: ProfileSettingsPage
})

function ProfileSettingsPage() {
  const { user } = Route.useRouteContext()
  return (
    <main className="min-h-screen bg-[var(--app-bg)] p-md text-[var(--app-text)]">
      <section className="mx-auto max-w-3xl rounded-sm border border-[var(--app-border)] bg-[var(--app-panel)] p-lg">
        <div className="flex items-start justify-between gap-md">
          <div>
            <p className="m-0 text-[11px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Profile</p>
            <h1 className="m-0 mt-xs text-[22px] font-[620] tracking-[-0.02em]">Account profile</h1>
          </div>
          <UserMenu user={user} />
        </div>
        <dl className="mt-lg grid gap-sm text-[12px]">
          <div className="rounded-sm border border-[var(--app-border)] bg-[var(--app-control)] p-sm"><dt className="text-[var(--app-muted)]">Email</dt><dd className="m-0 mt-xxs">{user.email}</dd></div>
          <div className="rounded-sm border border-[var(--app-border)] bg-[var(--app-control)] p-sm"><dt className="text-[var(--app-muted)]">Display name</dt><dd className="m-0 mt-xxs">{user.displayName || 'Not set'}</dd></div>
          <div className="rounded-sm border border-[var(--app-border)] bg-[var(--app-control)] p-sm"><dt className="text-[var(--app-muted)]">Provider</dt><dd className="m-0 mt-xxs">{user.provider}</dd></div>
        </dl>
      </section>
    </main>
  )
}
