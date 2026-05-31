type LoadingStateProps = {
  label?: string
  variant?: 'inline' | 'skeleton'
  lines?: number
}

export function LoadingState({ label = 'Loading...', variant = 'inline', lines = 3 }: LoadingStateProps) {
  if (variant === 'skeleton') {
    return (
      <div
        className="builder-truncate-safe rounded-md border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-md transition-colors duration-300"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">{label}</span>
        <div className="flex flex-col gap-sm" aria-hidden="true">
          {Array.from({ length: lines }).map((_, index) => (
            <div
              key={index}
              className="skeleton h-md"
              style={{ width: index === lines - 1 ? '60%' : '100%' }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="builder-truncate-safe rounded-md border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-md text-body-sm leading-[1.45] text-[var(--app-muted-text)] transition-colors duration-300" role="status" aria-live="polite">
      <span className="mr-sm inline-block h-sm w-sm animate-pulse rounded-full bg-[var(--app-accent)]" aria-hidden="true" />
      {label}
    </div>
  )
}
