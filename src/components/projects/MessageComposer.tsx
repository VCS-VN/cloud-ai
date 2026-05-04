import { ArrowUp, Plus, Wand2 } from 'lucide-react'
import type { FormEvent } from 'react'

type MessageComposerProps = {
  value: string
  sending?: boolean
  error?: string
  disabled?: boolean
  onChange: (value: string) => void
  onSend: (value: string) => Promise<void> | void
}

export function MessageComposer({ value, sending = false, error, disabled = false, onChange, onSend }: MessageComposerProps) {
  const canSend = value.trim().length > 0 && !sending && !disabled

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSend) return
    await onSend(value)
  }

  return (
    <form className="rounded-sm border border-[var(--app-border)] bg-[var(--app-control)] p-sm" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="project-message">Nhập tin nhắn</label>
      <textarea
        id="project-message"
        className="min-h-20 w-full resize-none border-0 bg-transparent p-0 text-[12px] leading-4 text-[var(--app-text)] outline-none placeholder:text-[var(--app-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
        value={value}
        placeholder="Ask Cloud AI..."
        disabled={sending || disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className="builder-truncate-safe mt-xs rounded-sm bg-coral p-sm text-[12px] leading-4 text-ink" role="alert">{error}</p> : null}
      <div className="mt-sm flex items-center justify-between gap-sm">
        <div className="flex items-center gap-xs">
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-muted)]" type="button" aria-label="Add context">
            <Plus aria-hidden="true" size={15} />
          </button>
          <span className="inline-flex h-8 items-center gap-xs rounded-pill bg-[var(--app-panel)] px-sm text-[12px] text-[var(--app-muted)]">
            <Wand2 aria-hidden="true" size={14} />
            Visual edits
          </span>
        </div>
        <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border-0 bg-[var(--app-text)] text-[var(--app-bg)] disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={!canSend} aria-label="Send message">
          <ArrowUp aria-hidden="true" size={16} />
        </button>
      </div>
    </form>
  )
}
