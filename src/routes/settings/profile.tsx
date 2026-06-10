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
    <main className="min-h-screen bg-paper p-4 text-ink">
      <section className="mx-auto max-w-3xl rounded-card border border-hairline bg-surface p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow m-0">Profile</p>
            <h1 className="m-0 mt-1 text-h2 font-semibold tracking-tight">Account profile</h1>
          </div>
          <UserMenu user={user} />
        </div>
        <dl className="mt-6 grid gap-3 text-ui-sm">
          <div className="rounded-card border border-hairline bg-chalk p-3"><dt className="text-muted">Email</dt><dd className="m-0 mt-1 break-all">{user.email}</dd></div>
          <div className="rounded-card border border-hairline bg-chalk p-3"><dt className="text-muted">Display name</dt><dd className="m-0 mt-1">{user.displayName || 'Not set'}</dd></div>
          <div className="rounded-card border border-hairline bg-chalk p-3"><dt className="text-muted">Provider</dt><dd className="m-0 mt-1">{user.provider}</dd></div>
        </dl>
      </section>
    </main>
  )
}
