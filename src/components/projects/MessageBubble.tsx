import type { Message } from '../../features/storefront-builder/types'

type MessageBubbleProps = {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const label = isUser ? 'Bạn' : 'Agent'

  return (
    <article className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[min(760px,100%)] rounded-lg border p-md ${
          isUser ? 'border-ink bg-ink text-on-primary' : 'border-hairline bg-surface-soft text-ink'
        }`}
      >
        <div className="mb-xs flex items-center justify-between gap-md font-mono text-caption uppercase tracking-[0.14em]">
          <span>{label}</span>
          <span>{message.status}</span>
        </div>
        <p className="m-0 whitespace-pre-wrap break-words text-body-sm">{message.content}</p>
      </div>
    </article>
  )
}
