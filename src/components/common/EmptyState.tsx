import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
  tone?: 'plain' | 'lime' | 'lilac' | 'cream' | 'pink' | 'mint'
}

const toneClassName: Record<NonNullable<EmptyStateProps['tone']>, string> = {
  plain: 'bg-surface-soft',
  lime: 'bg-lime',
  lilac: 'bg-lilac',
  cream: 'bg-cream',
  pink: 'bg-pink',
  mint: 'bg-mint'
}

export function EmptyState({ title, description, action, tone = 'plain' }: EmptyStateProps) {
  return (
    <section className={`${toneClassName[tone]} rounded-lg border border-hairline p-xl text-ink`}>
      <p className="m-0 font-mono text-caption uppercase tracking-[0.16em]">Trạng thái trống</p>
      <h2 className="mb-sm mt-md text-headline">{title}</h2>
      {description ? <p className="m-0 max-w-2xl text-body-sm">{description}</p> : null}
      {action ? <div className="mt-lg">{action}</div> : null}
    </section>
  )
}
