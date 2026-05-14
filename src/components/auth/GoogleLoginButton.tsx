import { ArrowRight, Loader2 } from 'lucide-react'

type GoogleLoginButtonProps = {
  loading?: boolean
  disabled?: boolean
  onClick: () => void
}

export function GoogleLoginButton({ loading = false, disabled = false, onClick }: GoogleLoginButtonProps) {
  return (
    <button
      className="inline-flex h-10 w-full items-center justify-center gap-xs rounded-pill border border-[var(--app-border-strong)] bg-[var(--app-text)] px-md text-[14px] font-[650] text-[var(--app-bg)] shadow-none outline-none transition-all duration-200 ease-out hover:opacity-86 focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-panel)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : <ArrowRight aria-hidden="true" size={16} />}
      <span>{loading ? 'Redirecting...' : 'Continue with Monmi Account'}</span>
    </button>
  )
}
