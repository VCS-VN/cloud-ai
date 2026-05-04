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
  if (loading) return <LoadingState label="Đang tải chat..." />
  if (error) return <ErrorState title="Không tải được chat" message={error} />
  if (messages.length === 0) {
    return <EmptyState title="Chưa có tin nhắn" description="Nhắn điều bạn muốn chỉnh, ví dụ màu sắc, nội dung hero hoặc thêm section mới." />
  }

  const orderedMessages = [...messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt))

  return (
    <section className="flex min-h-0 flex-col gap-sm overflow-y-auto pr-xs" aria-label="Message history">
      {orderedMessages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </section>
  )
}
