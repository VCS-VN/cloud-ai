import { useEffect, useMemo, useRef } from 'react'
import { EmptyState } from '../common/EmptyState'
import { ErrorState } from '../common/ErrorState'
import { LoadingState } from '../common/LoadingState'
import type { Message } from '@/shared/storefront-builder-types'
import { MessageBubble } from './MessageBubble'

type ProjectMessagesPanelProps = {
  messages: Message[]
  loading?: boolean
  loadingOlder?: boolean
  hasMore?: boolean
  error?: string
  onLoadOlder?: () => void
  onRetryMessage?: (messageId: string) => void
}

export function ProjectMessagesPanel({
  messages,
  loading = false,
  loadingOlder = false,
  hasMore = false,
  error,
  onLoadOlder,
  onRetryMessage
}: ProjectMessagesPanelProps) {
  const viewportRef = useRef<HTMLElement | null>(null)
  const topSentinelRef = useRef<HTMLDivElement | null>(null)
  const orderedMessages = useMemo(() => [...messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt)), [messages])

  const lastMessageId = orderedMessages[orderedMessages.length - 1]?.id
  const previousLastMessageIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || orderedMessages.length === 0) return

    const previousLastMessageId = previousLastMessageIdRef.current
    previousLastMessageIdRef.current = lastMessageId

    // Scroll to the bottom for initial load and bottom appends only.
    // Prepending older history keeps the same last message id, so the scroll position is preserved.
    if (!previousLastMessageId || previousLastMessageId !== lastMessageId) {
      viewport.scrollTop = viewport.scrollHeight
    }
  }, [lastMessageId, orderedMessages.length])

  useEffect(() => {
    if (!hasMore || loadingOlder || !onLoadOlder) return
    const viewport = viewportRef.current
    const sentinel = topSentinelRef.current
    if (!viewport || !sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onLoadOlder()
      },
      { root: viewport, rootMargin: '96px 0px 0px 0px', threshold: 0.01 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadingOlder, onLoadOlder])

  if (loading) return <LoadingState label="Loading chat..." />
  if (error) return <ErrorState title="Unable to load chat" message={error} />
  if (messages.length === 0) {
    return <EmptyState title="No messages yet" description="Describe what you want to adjust, like colors, hero copy, or a new section." />
  }

  return (
    <section id="project-messages-viewport" ref={viewportRef} className="flex min-h-0 flex-col gap-sm overflow-y-auto pr-xs scroll-smooth" aria-label="Message history">
      <div ref={topSentinelRef} className="h-px" aria-hidden="true" />
      {hasMore ? (
        <button className="mx-auto inline-flex items-center rounded-pill border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-sm py-xxs text-[11px] text-[var(--app-muted)] transition-colors duration-200 hover:border-[var(--app-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={onLoadOlder} disabled={loadingOlder} aria-busy={loadingOlder}>
          {loadingOlder ? 'Loading older messages...' : 'Load older messages'}
        </button>
      ) : null}
      {orderedMessages.map((message) => (
        <MessageBubble key={message.id} message={message} onRetry={onRetryMessage} />
      ))}
    </section>
  )
}
