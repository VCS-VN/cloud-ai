type LoadingStateProps = {
  label?: string
}

export function LoadingState({ label = 'Đang tải...' }: LoadingStateProps) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-soft p-lg text-body-sm text-ink" role="status" aria-live="polite">
      <span className="mr-sm inline-block h-sm w-sm animate-pulse rounded-full bg-ink" aria-hidden="true" />
      {label}
    </div>
  )
}
