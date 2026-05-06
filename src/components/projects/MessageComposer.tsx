import { ArrowUp, Loader2, Plus, Wand2 } from 'lucide-react'
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
    <form className="rounded-md border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-sm transition-colors duration-300 focus-within:border-[var(--app-border-strong)]" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="project-message">Enter message</label>
      <textarea
        id="project-message"
        className="min-h-20 w-full resize-none border-0 bg-transparent p-0 text-[12px] leading-4 text-[var(--app-panel-text)] outline-none placeholder:text-[var(--app-subtle-text)] disabled:cursor-not-allowed disabled:opacity-60"
        value={value}
        placeholder="Ask Cloud AI..."
        disabled={sending || disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className="builder-truncate-safe mt-xs rounded-md bg-[var(--app-danger-bg)] p-sm text-[12px] leading-4 text-[var(--app-danger-text)]" role="alert" aria-live="assertive">{error}</p> : null}
      <div className="mt-sm flex items-center justify-between gap-sm">
        <div className="flex items-center gap-xs">
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-icon-muted)] transition-colors duration-200 hover:text-[var(--app-icon)]" type="button" aria-label="Add context">
            <Plus aria-hidden="true" size={15} />
          </button>
          <span className="inline-flex h-8 items-center gap-xs rounded-pill bg-[var(--app-panel)] px-sm text-[12px] text-[var(--app-muted)] [&_svg]:text-[var(--app-icon-muted)] transition-colors duration-200">
            <Wand2 aria-hidden="true" size={14} />
            Visual edits
          </span>
        </div>
        <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border-0 bg-[var(--color-primary)] text-[var(--color-on-primary)] [&_svg]:text-current outline-none transition-transform duration-200 hover:scale-105 focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100" type="submit" disabled={!canSend} aria-label={sending ? 'Sending message...' : 'Send message'} aria-busy={sending}>
          {sending ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : <ArrowUp aria-hidden="true" size={16} />}
        </button>
      </div>
      <p className="sr-only" aria-live="polite">{sending ? 'Sending message.' : ''}</p>
    </form>
  )
}
