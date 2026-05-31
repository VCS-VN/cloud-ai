import { ArrowRight, Loader2 } from 'lucide-react'

type GoogleLoginButtonProps = {
  loading?: boolean
  disabled?: boolean
  onClick: () => void
}

export function GoogleLoginButton({ loading = false, disabled = false, onClick }: GoogleLoginButtonProps) {
  return (
    <button
      className="motion-press inline-flex h-11 w-full items-center justify-center gap-xs rounded-pill border border-[var(--app-border-strong)] bg-[var(--app-text)] px-md text-body-sm font-[650] text-[var(--app-bg)] outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-panel)] disabled:cursor-not-allowed disabled:opacity-60"
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : <ArrowRight aria-hidden="true" size={16} />}
      <span>{loading ? 'Redirecting...' : 'Continue with Monmi Account'}</span>
    </button>
  )
}
