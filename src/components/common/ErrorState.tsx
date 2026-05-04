import type { ReactNode } from 'react'

type ErrorStateProps = {
  title?: string
  message: string
  action?: ReactNode
}

export function ErrorState({ title = 'Có lỗi xảy ra', message, action }: ErrorStateProps) {
  return (
    <section className="builder-truncate-safe rounded-sm border border-ink bg-coral p-md text-ink" role="alert">
      <p className="builder-kicker">Lỗi</p>
      <h2 className="mb-xs mt-sm text-[16px] font-[520] leading-tight tracking-[-0.015em]">{title}</h2>
      <p className="m-0 text-[12px] leading-4 tracking-[-0.01em]">{message}</p>
      {action ? <div className="mt-md">{action}</div> : null}
    </section>
  )
}
