import { useState, type FormEvent } from "react";
import { ChevronDown, Mic, Plus, SendHorizonal } from "lucide-react";

type HomePromptFormProps = {
  prompt: string;
  loading?: boolean;
  error?: string;
  onPromptChange: (prompt: string) => void;
  onSubmit: (prompt: string) => Promise<void> | void;
};

const placeholders = [
  "Ask Cloud AI to create a website, app, or anything you imagine...",
  "Build a retail website with products, collections, and checkout pages...",
];

export function HomePromptForm({
  prompt,
  loading = false,
  error,
  onPromptChange,
  onSubmit,
}: HomePromptFormProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const canSubmit = prompt.trim().length > 0 && !loading;
  const placeholder = placeholders[placeholderIndex];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    await onSubmit(prompt);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) {
        event.currentTarget.form?.requestSubmit();
      }
    }
  }

  return (
    <form className="mx-auto w-full max-w-[1040px]" onSubmit={handleSubmit}>
      <div className="rounded-lg border border-[var(--app-composer-border)] bg-[var(--app-composer-bg)] p-md text-[var(--app-composer-text)] transition-all duration-300 ease-out focus-within:-translate-y-0.5 focus-within:border-[var(--app-composer-border-focus)] focus-within:ring-2 focus-within:ring-[var(--app-focus-ring)] sm:p-lg">
        <label className="sr-only" htmlFor="project-prompt">
          Describe what you want to build
        </label>
        <div className="relative min-h-[112px]">
          {!prompt ? (
            <span
              className="pointer-events-none absolute left-0 top-0 max-w-full overflow-hidden whitespace-nowrap text-body font-[330] leading-[1.45] text-[var(--app-subtle-text)] [animation:prompt-placeholder-reveal_4.8s_ease-in-out_infinite]"
              onAnimationIteration={() =>
                setPlaceholderIndex((current) =>
                  current === placeholders.length - 1 ? 0 : current + 1,
                )
              }
            >
              {placeholder}
            </span>
          ) : null}
          <textarea
            id="project-prompt"
            className="relative min-h-[112px] w-full resize-none border-0 bg-transparent p-0 text-body font-[330] leading-[1.45] text-[var(--app-composer-text)] outline-none disabled:cursor-not-allowed disabled:opacity-60"
            value={prompt}
            placeholder=""
            disabled={loading}
            onChange={(event) => onPromptChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="mt-md flex items-end justify-between gap-sm">
          <button
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-icon-muted)] outline-none transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-[var(--app-icon)] focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            type="button"
            aria-label="Add attachment"
            disabled={loading}
          >
            <Plus aria-hidden="true" size={24} strokeWidth={1.8} />
          </button>

          <div className="flex items-center gap-sm text-[var(--app-icon-muted)]">
            <button
              className="inline-flex h-10 items-center gap-xxs rounded-pill border border-transparent px-sm text-button font-[480] outline-none transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--app-border)] hover:bg-[var(--app-control)] focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              type="button"
              disabled={loading}
            >
              Build
              <ChevronDown aria-hidden="true" size={16} />
            </button>
            <button
              className="hidden h-10 w-10 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-icon-muted)] outline-none transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-[var(--app-icon)] focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:inline-flex"
              type="button"
              aria-label="Use microphone"
              disabled={loading}
            >
              <Mic aria-hidden="true" size={20} strokeWidth={1.8} />
            </button>
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--app-pill-bg)] text-[var(--app-pill-text)] outline-none transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--app-pill-hover)] focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 [&_svg]:text-[var(--app-icon-selected)]"
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
