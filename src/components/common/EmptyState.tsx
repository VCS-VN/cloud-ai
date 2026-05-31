import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
  tone?: 'plain' | 'lime' | 'lilac' | 'cream' | 'pink' | 'mint'
}

const toneClassName: Record<NonNullable<EmptyStateProps['tone']>, string> = {
  plain: 'bg-[var(--app-panel-bg)] text-[var(--app-panel-text)]',
  lime: 'bg-[var(--color-block-lime)] text-[var(--app-on-color-block)]',
  lilac: 'bg-[var(--color-block-lilac)] text-[var(--app-on-color-block)]',
  cream: 'bg-[var(--color-block-cream)] text-[var(--app-on-color-block)]',
  pink: 'bg-[var(--color-block-pink)] text-[var(--app-on-color-block)]',
  mint: 'bg-[var(--color-block-mint)] text-[var(--app-on-color-block)]'
}

export function EmptyState({ title, description, action, tone = 'plain' }: EmptyStateProps) {
  return (
    <section className={`${toneClassName[tone]} builder-truncate-safe rounded-md border border-[var(--color-hairline)] p-md transition-colors duration-300`}>
      <p className="builder-kicker text-current opacity-65">Empty state</p>
      <h2 className="mb-xs mt-sm text-body font-[540] leading-tight tracking-[-0.26px]">{title}</h2>
      {description ? <p className="m-0 max-w-2xl text-body-sm leading-[1.45] tracking-[-0.14px] text-current opacity-70">{description}</p> : null}
      {action ? <div className="mt-md">{action}</div> : null}
    </section>
  )
}
