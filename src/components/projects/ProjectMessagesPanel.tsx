import { EmptyState } from '../common/EmptyState'
import { ErrorState } from '../common/ErrorState'
import { LoadingState } from '../common/LoadingState'
import type { Message } from '../../features/storefront-builder/types'
import { MessageBubble } from './MessageBubble'

type ProjectMessagesPanelProps = {
  messages: Message[]
  loading?: boolean
  error?: string
}

export function ProjectMessagesPanel({ messages, loading = false, error }: ProjectMessagesPanelProps) {
  if (loading) return <LoadingState label="Đang tải message history..." />
  if (error) return <ErrorState title="Không tải được messages" message={error} />
  if (messages.length === 0) {
    return <EmptyState title="Chưa có message" description="Conversation của project này sẽ xuất hiện ở đây khi bạn bắt đầu nhắn." />
  }

  const orderedMessages = [...messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt))

  return (
    <section className="flex min-h-0 flex-col gap-md overflow-y-auto" aria-label="Message history">
      {orderedMessages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </section>
  )
}
