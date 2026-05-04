import type { FormEvent } from 'react'

type HomePromptFormProps = {
  prompt: string
  loading?: boolean
  error?: string
  onPromptChange: (prompt: string) => void
  onSubmit: (prompt: string) => Promise<void> | void
}

const placeholder =
  'Ví dụ: Tạo website bán giày cao gót phong cách sang trọng, màu đen vàng, dành cho khách hàng nữ công sở...'

export function HomePromptForm({ prompt, loading = false, error, onPromptChange, onSubmit }: HomePromptFormProps) {
  const canSubmit = prompt.trim().length > 0 && !loading

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    await onSubmit(prompt)
  }

  return (
    <form className="mx-auto flex w-full max-w-4xl flex-col gap-lg rounded-xl border border-hairline bg-canvas p-xl shadow-panel" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-sm" htmlFor="storefront-prompt">
        <span className="font-mono text-caption uppercase tracking-[0.16em] text-ink">Prompt storefront</span>
        <textarea
          id="storefront-prompt"
          className="min-h-40 w-full resize-y rounded-md border border-hairline bg-canvas px-md py-sm text-body text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
          value={prompt}
          placeholder={placeholder}
          disabled={loading}
          onChange={(event) => onPromptChange(event.target.value)}
        />
      </label>

      {error ? <p className="m-0 rounded-md border border-ink bg-coral p-sm text-body-sm text-ink" role="alert">{error}</p> : null}

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 text-body-sm text-ink">Không sao nếu prompt dài — nội dung sẽ tự wrap để không vỡ layout.</p>
        <button
          className="rounded-pill bg-primary px-lg py-sm text-button text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={!canSubmit}
        >
          {loading ? 'Đang tạo...' : 'Tạo storefront'}
        </button>
      </div>
    </form>
  )
}
