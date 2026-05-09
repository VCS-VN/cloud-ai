import { ArrowDown, ArrowUp, Loader2, Plus, Square, Wand2 } from "lucide-react";
import type { FormEvent } from "react";
import type { ComposerReasoningEffort } from "@/shared/project-types";

type MessageComposerProps = {
  value: string;
  reasoningEffort: ComposerReasoningEffort;
  planMode: boolean;
  sending?: boolean;
  processing?: boolean;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onReasoningEffortChange: (value: ComposerReasoningEffort) => void;
  onPlanModeChange: (value: boolean) => void;
  onSend: (value: string) => Promise<void> | void;
  onStop?: () => Promise<void> | void;
  onScrollMessagesUp?: () => void;
  onScrollMessagesDown?: () => void;
};

const reasoningEffortOptions: ComposerReasoningEffort[] = [
  "low",
  "medium",
  "high",
  "xhigh",
];

export function MessageComposer({
  value,
  reasoningEffort,
  planMode,
  sending = false,
  processing = false,
  error,
  disabled = false,
  onChange,
  onReasoningEffortChange,
  onPlanModeChange,
  onSend,
  onStop,
}: MessageComposerProps) {
  const canSend = value.trim().length > 0 && !sending && !disabled;
  const canStop = processing && !sending && !!onStop;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    await onSend(value);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        event.currentTarget.form?.requestSubmit();
      }
    }
  }

  return (
    <form
      className="rounded-md border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-sm transition-colors duration-300 focus-within:border-[var(--app-border-strong)]"
      onSubmit={handleSubmit}
    >
      <label className="sr-only" htmlFor="project-message">
        Enter message
      </label>

      <textarea
        id="project-message"
        className="min-h-32 w-full resize-none border-0 bg-transparent p-0 text-[12px] leading-4 text-[var(--app-panel-text)] outline-none placeholder:text-[var(--app-subtle-text)] disabled:cursor-not-allowed disabled:opacity-60"
        value={value}
        style={{
          minHeight: 120,
        }}
        placeholder="Ask Cloud AI..."
        disabled={sending || disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      {error ? (
        <p
          className="builder-truncate-safe mt-xs rounded-md bg-[var(--app-danger-bg)] p-sm text-[12px] leading-4 text-[var(--app-danger-text)]"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-sm flex flex-wrap items-center gap-xs border-t border-[var(--app-border)] pt-sm">
        <label className="inline-flex h-8 items-center gap-xs rounded-pill border border-[var(--app-border)] bg-[var(--app-control)] px-sm text-[12px] text-[var(--app-muted)] transition-colors duration-200 focus-within:border-[var(--app-border-strong)] focus-within:ring-2 focus-within:ring-[var(--app-focus-ring)]">
          <span>Reasoning</span>
          <select
            className="border-0 bg-transparent text-[12px] font-medium capitalize text-[var(--app-panel-text)] outline-none disabled:cursor-not-allowed disabled:opacity-60"
            value={reasoningEffort}
            disabled={sending || disabled}
            onChange={(event) =>
              onReasoningEffortChange(
                event.target.value as ComposerReasoningEffort,
              )
            }
            aria-label="Reasoning effort"
          >
            {reasoningEffortOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button
          className={`inline-flex h-8 items-center gap-xs rounded-pill border px-sm text-[12px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 ${planMode ? "border-[var(--app-border-strong)] bg-[var(--color-block-lime)] text-[var(--app-on-color-block)] [&_svg]:text-[var(--app-icon-on-color-block)]" : "border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-muted)] hover:border-[var(--app-border-strong)] hover:text-[var(--app-panel-text)] [&_svg]:text-[var(--app-icon-muted)]"}`}
          type="button"
          aria-pressed={planMode}
          disabled={sending || disabled}
          onClick={() => onPlanModeChange(!planMode)}
        >
          <Wand2 aria-hidden="true" size={14} />
          Plan mode {planMode ? "on" : "off"}
        </button>
      </div>

      <div className="mt-sm flex items-center justify-between gap-sm">
        <div className="flex items-center gap-xs">
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-icon-muted)] transition-colors duration-200 hover:text-[var(--app-icon)]"
            type="button"
            aria-label="Add context"
          >
            <Plus aria-hidden="true" size={15} />
          </button>
          <span className="inline-flex h-8 items-center gap-xs rounded-pill bg-[var(--app-panel)] px-sm text-[12px] text-[var(--app-muted)] [&_svg]:text-[var(--app-icon-muted)] transition-colors duration-200">
            <Wand2 aria-hidden="true" size={14} />
            Visual edits
          </span>
        </div>
        <div className="flex items-center gap-xs">
          {canStop ? (
            <button
              className="inline-flex h-8 items-center gap-xs rounded-pill border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-sm text-[12px] text-[var(--app-panel-text)] transition-colors duration-200 hover:border-[var(--app-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
              type="button"
              onClick={() => void onStop?.()}
              aria-label="Stop generating"
            >
              <Square
                aria-hidden="true"
                className="text-[var(--app-icon)]"
                size={12}
              />
              Stop
            </button>
          ) : null}
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border-0 bg-[var(--color-primary)] text-[var(--color-on-primary)] [&_svg]:text-current outline-none transition-transform duration-200 hover:scale-105 focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            type="submit"
            disabled={!canSend}
            aria-label={sending ? "Sending message..." : "Send message"}
            aria-busy={sending}
          >
            {sending ? (
              <Loader2 aria-hidden="true" className="animate-spin" size={16} />
            ) : (
              <ArrowUp aria-hidden="true" size={16} />
            )}
          </button>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {sending
          ? "Sending message."
          : processing
            ? "Generating response."
            : ""}
      </p>
    </form>
  );
}
