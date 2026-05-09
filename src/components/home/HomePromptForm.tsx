import type { FormEvent } from "react";
import { ChevronDown, Mic, Plus, SendHorizonal } from "lucide-react";

type HomePromptFormProps = {
  prompt: string;
  loading?: boolean;
  error?: string;
  onPromptChange: (prompt: string) => void;
  onSubmit: (prompt: string) => Promise<void> | void;
};

const placeholder = "Ask Cloud AI to create a website, app, or anything you imagine...";

export function HomePromptForm({
  prompt,
  loading = false,
  error,
  onPromptChange,
  onSubmit,
}: HomePromptFormProps) {
  const canSubmit = prompt.trim().length > 0 && !loading;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    await onSubmit(prompt);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) {
        event.currentTarget.form?.requestSubmit();
      }
    }
  }

  return (
    <form className="mx-auto w-full max-w-[1040px]" onSubmit={handleSubmit}>
      <div className="rounded-md border border-[var(--app-composer-border)] bg-[var(--app-composer-bg)] p-md text-[var(--app-composer-text)] transition-colors duration-200 focus-within:border-[var(--app-composer-border-focus)] sm:p-lg">
        <label className="sr-only" htmlFor="project-prompt">
          Describe what you want to build
        </label>
        <textarea
          id="project-prompt"
          className="min-h-[112px] w-full resize-none border-0 bg-transparent p-0 text-body font-[330] leading-[1.45] text-[var(--app-composer-text)] outline-none placeholder:text-[var(--app-subtle-text)] disabled:cursor-not-allowed disabled:opacity-60"
          value={prompt}
          placeholder={placeholder}
          disabled={loading}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />

        <div className="mt-md flex items-end justify-between gap-sm">
          <button
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--app-control)] text-[var(--app-icon-muted)] outline-none transition-colors duration-200 hover:text-[var(--app-icon)] focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            aria-label="Add attachment"
            disabled={loading}
          >
            <Plus aria-hidden="true" size={24} strokeWidth={1.8} />
          </button>

          <div className="flex items-center gap-sm text-[var(--app-icon-muted)]">
            <button
              className="inline-flex h-10 items-center gap-xxs rounded-pill px-sm text-button font-[480] outline-none transition-colors duration-200 hover:bg-[var(--app-control)] focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={loading}
            >
              Build
              <ChevronDown aria-hidden="true" size={16} />
            </button>
            <button
              className="hidden h-10 w-10 items-center justify-center rounded-full bg-[var(--app-control)] text-[var(--app-icon-muted)] outline-none transition-colors duration-200 hover:text-[var(--app-icon)] focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
              type="button"
              aria-label="Use microphone"
              disabled={loading}
            >
              <Mic aria-hidden="true" size={20} strokeWidth={1.8} />
            </button>
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--app-pill-bg)] text-[var(--app-pill-text)] [&_svg]:text-[var(--app-icon-selected)] outline-none transition-colors duration-200 hover:bg-[var(--app-pill-hover)] focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-45"
              type="submit"
              disabled={!canSubmit}
              aria-label={loading ? "Building project..." : "Build project"}
              aria-busy={loading}
            >
              <SendHorizonal
                aria-hidden="true"
                className={loading ? "animate-pulse" : ""}
                size={22}
              />
              {loading ? (
                <span className="sr-only">Building project...</span>
              ) : null}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <p
          className="mx-auto mt-sm max-w-[1040px] rounded-md border border-[var(--app-border)] bg-[var(--app-danger-bg)] p-sm text-[14px] leading-5 text-[var(--app-danger-text)]"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {loading ? "Creating your project and preparing the workspace." : ""}
      </p>
    </form>
  );
}
