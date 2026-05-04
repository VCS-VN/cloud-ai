import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { LogOut, Loader2, UserRound } from 'lucide-react'
import { signOutFirebaseClient } from '../../auth/firebase-client'
import type { AuthUserSummary } from '../../auth/types'
import { logout } from '../../server/functions/auth'

type UserMenuProps = {
  user?: AuthUserSummary | null
  onProfile?: () => void
  compact?: boolean
}

export function UserMenu({ user, onProfile, compact = false }: UserMenuProps) {
  const navigate = useNavigate()
  const logoutFn = useServerFn(logout)
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    if (loading) return
    setLoading(true)
    try {
      const result = await logoutFn()
      await signOutFirebaseClient().catch(() => undefined)
      await navigate({ to: result.redirectTo })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-xs">
      {onProfile ? (
        <button
          className="inline-flex h-9 items-center gap-xs rounded-md border border-[var(--app-border)] bg-[var(--app-control)] px-sm text-[13px] text-[var(--app-muted)] hover:text-[var(--app-text)]"
          type="button"
          onClick={onProfile}
          title={user?.email}
        >
          <UserRound aria-hidden="true" size={15} />
          {!compact ? <span>{user?.displayName || user?.email || 'Profile'}</span> : null}
        </button>
      ) : null}
      <button
        className="inline-flex h-9 items-center gap-xs rounded-md border border-[var(--app-border)] bg-[var(--app-control)] px-sm text-[13px] text-[var(--app-muted)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        onClick={handleLogout}
        disabled={loading}
      >
        {loading ? <Loader2 aria-hidden="true" className="animate-spin" size={15} /> : <LogOut aria-hidden="true" size={15} />}
        {!compact ? <span>Đăng xuất</span> : null}
      </button>
    </div>
  )
}
