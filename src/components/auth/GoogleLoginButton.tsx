import { Loader2 } from 'lucide-react'

type GoogleLoginButtonProps = {
  loading?: boolean
  disabled?: boolean
  onClick: () => void
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.22c1.89-1.74 2.99-4.3 2.99-7.52Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.25l-3.22-2.51c-.9.6-2.04.95-3.39.95-2.6 0-4.81-1.76-5.6-4.12H3.08v2.59A9.99 9.99 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 14.07A6.01 6.01 0 0 1 6.08 12c0-.72.12-1.42.32-2.07V7.34H3.08A9.99 9.99 0 0 0 2 12c0 1.61.39 3.14 1.08 4.66l3.32-2.59Z" />
      <path fill="#EA4335" d="M12 5.81c1.47 0 2.78.5 3.82 1.5l2.86-2.86C16.95 2.84 14.7 2 12 2a9.99 9.99 0 0 0-8.92 5.34L6.4 9.93c.79-2.36 3-4.12 5.6-4.12Z" />
    </svg>
  )
}

export function GoogleLoginButton({ loading = false, disabled = false, onClick }: GoogleLoginButtonProps) {
  return (
    <button
      className="inline-flex h-10 items-center justify-center gap-xs rounded-pill border border-[var(--app-border-strong)] bg-[var(--app-text)] px-md text-[14px] font-[650] text-[var(--app-bg)] shadow-none outline-none transition-all duration-200 ease-out hover:opacity-86 focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-panel)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : <GoogleIcon />}
      <span>{loading ? 'Signing in...' : 'Sign in'}</span>
    </button>
  )
}
