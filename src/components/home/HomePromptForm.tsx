import type { FormEvent } from 'react'
import { ChevronDown, Mic, Plus, SendHorizonal } from 'lucide-react'

type HomePromptFormProps = {
  prompt: string
  loading?: boolean
  error?: string
  onPromptChange: (prompt: string) => void
  onSubmit: (prompt: string) => Promise<void> | void
}

const placeholder = 'Ask Cloud AI to create a'

export function HomePromptForm({ prompt, loading = false, error, onPromptChange, onSubmit }: HomePromptFormProps) {
  const canSubmit = prompt.trim().length > 0 && !loading

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    await onSubmit(prompt)
  }

  return (
    <form className="mx-auto w-full max-w-[1040px]" onSubmit={handleSubmit}>
      <div className="min-h-[220px] rounded-[32px] border border-white/10 bg-[#20211f] p-md text-[#f7f4ed] shadow-[0_26px_90px_rgb(0_0_0_/_0.34)] ring-2 ring-black/25 transition-all duration-300 ease-out focus-within:translate-y-[-2px] focus-within:border-white/18 focus-within:shadow-[0_34px_110px_rgb(0_0_0_/_0.42)] sm:min-h-[240px] sm:rounded-[36px] sm:p-lg">
        <label className="sr-only" htmlFor="storefront-prompt">Describe what you want to build</label>
        <textarea
          id="storefront-prompt"
          className="min-h-[132px] w-full resize-none border-0 bg-transparent p-0 text-[22px] font-[420] leading-8 text-[#f7f4ed] outline-none placeholder:text-[#b9b6ae] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[142px] sm:text-[24px]"
          value={prompt}
          placeholder={placeholder}
          disabled={loading}
          onChange={(event) => onPromptChange(event.target.value)}
        />

        <div className="mt-md flex items-end justify-between gap-sm">
          <button
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-[#c9c6bd] outline-none transition-all duration-200 ease-out hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            aria-label="Add attachment"
            disabled={loading}
          >
            <Plus aria-hidden="true" size={24} strokeWidth={1.8} />
          </button>

          <div className="flex items-center gap-sm text-[#aaa69d]">
            <button
              className="inline-flex h-10 items-center gap-xxs rounded-pill px-sm text-[17px] font-[520] outline-none transition-all duration-200 ease-out hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={loading}
            >
              Build
              <ChevronDown aria-hidden="true" size={16} />
            </button>
            <button
              className="hidden h-10 w-10 items-center justify-center rounded-full outline-none transition-all duration-200 ease-out hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
              type="button"
              aria-label="Use microphone"
              disabled={loading}
            >
              <Mic aria-hidden="true" size={20} strokeWidth={1.8} />
            </button>
            <button
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#b9bab5] text-[#1f201e] outline-none transition-all duration-200 ease-out hover:scale-105 hover:bg-white focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100"
              type="submit"
              disabled={!canSubmit}
              aria-label="Build project"
            >
              <SendHorizonal aria-hidden="true" className={loading ? 'animate-pulse' : ''} size={22} />
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <p className="mx-auto mt-sm max-w-[1040px] rounded-md border border-white/15 bg-black/25 p-sm text-[14px] leading-5 text-white shadow-panel backdrop-blur" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  )
}
