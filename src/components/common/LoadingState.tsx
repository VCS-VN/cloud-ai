type LoadingStateProps = {
  label?: string
}

export function LoadingState({ label = 'Đang tải...' }: LoadingStateProps) {
  return (
    <div className="builder-truncate-safe rounded-sm border border-hairline bg-surface-soft p-md text-[12px] leading-4 text-ink" role="status" aria-live="polite">
      <span className="mr-sm inline-block h-sm w-sm animate-pulse rounded-full bg-ink" aria-hidden="true" />
      {label}
    </div>
  )
}
