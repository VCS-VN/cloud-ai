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
    <form className="border-t border-hairline pt-md" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="project-message">Nhập message</label>
      <textarea
        id="project-message"
        className="min-h-28 w-full resize-y rounded-md border border-hairline bg-canvas px-md py-sm text-body-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 disabled:opacity-60"
        value={value}
        placeholder="Nhắn tiếp để tinh chỉnh storefront..."
        disabled={sending || disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className="mt-xs rounded-md bg-coral p-sm text-body-sm text-ink" role="alert">{error}</p> : null}
      <div className="mt-sm flex justify-end">
        <button className="rounded-pill bg-primary px-lg py-sm text-button text-on-primary disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={!canSend}>
          {sending ? 'Đang gửi...' : 'Gửi'}
        </button>
      </div>
    </form>
  )
}
