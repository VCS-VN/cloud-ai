import { CheckCircle2, Clock3, AlertCircle, RefreshCw } from 'lucide-react'
import type { Message } from '@/shared/storefront-builder-types'

type MessageBubbleProps = {
  message: Message
  onRetry?: (messageId: string) => void
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const label = isUser ? 'You' : 'Agent'
  const isFailed = message.processingStatus === 'failed'
  const isPending = message.processingStatus === 'pending'
  const canRetry = isFailed && !message.id.startsWith('client-') && !!onRetry

  return (
    <article className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`builder-truncate-safe max-w-[min(380px,92%)] rounded-md border px-sm py-xs transition-all duration-200 ${
          isUser
            ? 'border-[var(--app-border-strong)] bg-[var(--app-selected-bg)] text-[var(--app-selected-text)]'
            : isFailed
              ? 'border-[var(--app-border-strong)] bg-[var(--app-danger-bg)] text-[var(--app-danger-text)]'
            : 'border-[var(--app-border)] bg-[var(--app-panel-bg)] text-[var(--app-panel-text)]'
        } ${isPending ? 'opacity-70' : 'opacity-100'}`}
      >
        <div className="mb-xs flex items-center justify-between gap-sm text-[11px] uppercase tracking-[0.08em] text-current opacity-[0.62] [&_svg]:text-current">
          <span className="inline-flex items-center gap-xxs">
            {isFailed ? <AlertCircle aria-hidden="true" size={12} /> : isUser || isPending ? <Clock3 aria-hidden="true" size={12} /> : <CheckCircle2 aria-hidden="true" size={12} />}
            {label}
          </span>
          <span className="flex items-center gap-xxs">
            {isPending ? <RefreshCw aria-hidden="true" size={12} className="animate-spin" /> : null}
            {message.processingStatus}
          </span>
        </div>
        <p className="m-0 whitespace-pre-wrap text-[12px] leading-4 tracking-[-0.01em]">{message.content}</p>
        
        {canRetry ? (
          <div className="mt-sm flex justify-end">
            <button 
              onClick={() => onRetry(message.id)}
              className="inline-flex items-center gap-xxs rounded-pill border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-sm py-xxs text-[11px] font-[520] text-current outline-none transition-colors hover:border-[var(--app-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
            >
              <RefreshCw aria-hidden="true" size={12} />
              Retry
            </button>
          </div>
        ) : null}
        
        {!isUser && !isFailed && !isPending ? (
          <div className="mt-sm rounded-md border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-xs text-[12px] leading-4 text-[var(--app-muted-text)]">
            Result ready · Use Preview or Code to inspect the generated output.
          </div>
        ) : null}
      </div>
    </article>
  )
}
