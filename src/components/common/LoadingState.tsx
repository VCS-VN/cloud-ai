type LoadingStateProps = {
  label?: string
}

export function LoadingState({ label = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="builder-truncate-safe rounded-md border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-md text-[12px] leading-4 text-[var(--app-muted-text)] transition-colors duration-300" role="status" aria-live="polite">
      <span className="mr-sm inline-block h-sm w-sm animate-pulse rounded-full bg-[var(--app-accent)]" aria-hidden="true" />
      {label}
    </div>
  )
}
