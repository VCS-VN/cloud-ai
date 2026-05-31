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
      <section className="mx-auto max-w-3xl rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] p-lg">
        <div className="flex items-start justify-between gap-md">
          <div>
            <p className="m-0 font-mono text-caption uppercase tracking-[0.6px] text-[var(--app-muted)]">Profile</p>
            <h1 className="m-0 mt-xs text-headline font-[540] tracking-[-0.26px]">Account profile</h1>
          </div>
          <UserMenu user={user} />
        </div>
        <dl className="mt-lg grid gap-sm text-body-sm">
          <div className="rounded-md border border-[var(--app-border)] bg-[var(--app-control)] p-sm"><dt className="text-[var(--app-muted)]">Email</dt><dd className="m-0 mt-xxs break-all">{user.email}</dd></div>
          <div className="rounded-md border border-[var(--app-border)] bg-[var(--app-control)] p-sm"><dt className="text-[var(--app-muted)]">Display name</dt><dd className="m-0 mt-xxs">{user.displayName || 'Not set'}</dd></div>
          <div className="rounded-md border border-[var(--app-border)] bg-[var(--app-control)] p-sm"><dt className="text-[var(--app-muted)]">Provider</dt><dd className="m-0 mt-xxs">{user.provider}</dd></div>
        </dl>
      </section>
    </main>
  )
}
