type LoadingStateProps = {
  label?: string
  variant?: 'inline' | 'skeleton'
  lines?: number
}

export function LoadingState({ label = 'Loading...', variant = 'inline', lines = 3 }: LoadingStateProps) {
  if (variant === 'skeleton') {
    return (
      <div
        className="card p-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">{label}</span>
        <div className="flex flex-col gap-3" aria-hidden="true">
          {Array.from({ length: lines }).map((_, index) => (
            <div
              key={index}
              className="skeleton h-4"
              style={{ width: index === lines - 1 ? '60%' : '100%' }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4 text-body text-muted" role="status" aria-live="polite">
      <span className="mr-3 inline-block h-3 w-3 animate-pulse-soft rounded-pill bg-ink" aria-hidden="true" />
      {label}
    </div>
  )
}
