import { CheckCircle2, Clock3 } from 'lucide-react'
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
        className={`builder-truncate-safe max-w-[min(380px,92%)] rounded-md border px-sm py-xs ${
          isUser
            ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_18%,var(--app-panel))] text-[var(--app-text)]'
            : 'border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-text)]'
        }`}
      >
        <div className="mb-xs flex items-center justify-between gap-sm text-[11px] uppercase tracking-[0.08em] text-[var(--app-subtle)]">
          <span className="inline-flex items-center gap-xxs">
            {isUser ? <Clock3 aria-hidden="true" size={12} /> : <CheckCircle2 aria-hidden="true" size={12} />}
            {label}
          </span>
          <span>{message.status}</span>
        </div>
        <p className="m-0 whitespace-pre-wrap text-[14px] leading-5 tracking-[-0.01em]">{message.content}</p>
        {!isUser ? (
          <div className="mt-sm rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] p-xs text-[12px] leading-4 text-[var(--app-muted)]">
            Result ready · Use Preview or Code to inspect the generated output.
          </div>
        ) : null}
      </div>
    </article>
  )
}
