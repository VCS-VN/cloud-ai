import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
  /** Legacy prop — Cloud AI identity has no per-tone surface; value is ignored. */
  tone?: 'plain' | 'lime' | 'lilac' | 'cream' | 'pink' | 'mint'
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="card p-4">
      <p className="eyebrow text-current opacity-65">Empty state</p>
      <h2 className="mb-2 mt-3 text-card-title font-semibold leading-tight">{title}</h2>
      {description ? <p className="m-0 max-w-2xl text-body leading-normal text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  )
}
