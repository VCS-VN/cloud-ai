import type { ReactNode } from 'react'

type ErrorStateProps = {
  title?: string
  message: string
  action?: ReactNode
}

export function ErrorState({ title = 'Something went wrong', message, action }: ErrorStateProps) {
  return (
    <section className="rounded-card border border-hairline bg-danger-bg p-4 text-danger-fg" role="alert">
      <p className="eyebrow opacity-70">Error</p>
      <h2 className="mb-2 mt-3 text-card-title font-semibold leading-tight">{title}</h2>
      <p className="m-0 text-body leading-normal">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  )
}
