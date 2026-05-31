import type { ReactNode } from 'react'

type ErrorStateProps = {
  title?: string
  message: string
  action?: ReactNode
}

export function ErrorState({ title = 'Something went wrong', message, action }: ErrorStateProps) {
  return (
    <section className="builder-truncate-safe rounded-md border border-[var(--app-border-strong)] bg-[var(--app-danger-bg)] p-md text-[var(--app-danger-text)] transition-colors duration-300" role="alert">
      <p className="builder-kicker opacity-70">Error</p>
      <h2 className="mb-xs mt-sm text-body font-[540] leading-tight tracking-[-0.26px]">{title}</h2>
      <p className="m-0 text-body-sm leading-[1.45] tracking-[-0.14px]">{message}</p>
      {action ? <div className="mt-md">{action}</div> : null}
    </section>
  )
}
