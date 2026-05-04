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
    <section className={`${toneClassName[tone]} builder-truncate-safe rounded-sm border border-hairline p-md text-ink`}>
      <p className="builder-kicker">Trạng thái trống</p>
      <h2 className="mb-xs mt-sm text-[16px] font-[520] leading-tight tracking-[-0.015em]">{title}</h2>
      {description ? <p className="m-0 max-w-2xl text-[12px] leading-4 tracking-[-0.01em]">{description}</p> : null}
      {action ? <div className="mt-md">{action}</div> : null}
    </section>
  )
}
