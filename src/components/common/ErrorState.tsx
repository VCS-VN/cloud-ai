import type { ReactNode } from 'react'

type ErrorStateProps = {
  title?: string
  message: string
  action?: ReactNode
}

export function ErrorState({ title = 'Có lỗi xảy ra', message, action }: ErrorStateProps) {
  return (
    <section className="rounded-lg border border-ink bg-coral p-lg text-ink" role="alert">
      <p className="m-0 font-mono text-caption uppercase tracking-[0.16em]">Lỗi</p>
      <h2 className="mb-xs mt-sm text-headline">{title}</h2>
      <p className="m-0 text-body-sm">{message}</p>
      {action ? <div className="mt-md">{action}</div> : null}
    </section>
  )
}
