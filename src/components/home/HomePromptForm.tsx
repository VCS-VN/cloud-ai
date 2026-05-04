import type { FormEvent } from 'react'

type HomePromptFormProps = {
  prompt: string
  loading?: boolean
  error?: string
  onPromptChange: (prompt: string) => void
  onSubmit: (prompt: string) => Promise<void> | void
}

const placeholder =
  'Ví dụ: Tạo website bán hoa tươi nhẹ nhàng, có trang giới thiệu, danh mục sản phẩm và nút đặt hàng nhanh...'

export function HomePromptForm({ prompt, loading = false, error, onPromptChange, onSubmit }: HomePromptFormProps) {
  const canSubmit = prompt.trim().length > 0 && !loading

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    await onSubmit(prompt)
  }

  return (
    <form className="builder-panel mx-auto flex w-full max-w-3xl flex-col gap-md p-sm sm:p-md" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-sm" htmlFor="storefront-prompt">
        <span className="builder-kicker text-ink">Ý tưởng website của bạn</span>
        <textarea
          id="storefront-prompt"
          className="builder-input min-h-28 resize-y px-md py-sm disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-32"
          value={prompt}
          placeholder={placeholder}
          disabled={loading}
          onChange={(event) => onPromptChange(event.target.value)}
        />
      </label>

      {error ? <p className="builder-truncate-safe m-0 rounded-md border border-ink bg-coral p-sm text-[14px] leading-5 text-ink" role="alert">{error}</p> : null}

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="builder-truncate-safe m-0 text-[14px] leading-5 text-ink/70">Viết tự nhiên như đang mô tả cho một designer. Prompt dài vẫn tự xuống dòng.</p>
        <button
          className="builder-button shrink-0"
          type="submit"
          disabled={!canSubmit}
        >
          {loading ? 'Đang tạo...' : 'Bắt đầu tạo'}
        </button>
      </div>
    </form>
  )
}
