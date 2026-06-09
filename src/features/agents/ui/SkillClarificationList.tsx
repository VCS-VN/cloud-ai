import { useState } from "react";
import { Loader2 } from "lucide-react";

export type SkillClarificationOption = {
  id: string;
  label: string;
};

export type SkillClarificationListProps = {
  question?: string;
  options: SkillClarificationOption[];
  onSelect: (optionId: string) => Promise<void> | void;
  disabled?: boolean;
};

export function SkillClarificationList({
  question,
  options,
  onSelect,
  disabled,
}: SkillClarificationListProps) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [committed, setCommitted] = useState<SkillClarificationOption | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!pickedId || submitting) return;
    const picked = options.find((o) => o.id === pickedId);
    if (!picked) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await onSelect(picked.id);
      setCommitted(picked);
    } catch (cause) {
      setErrorMessage(extractMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const isBusy = disabled || submitting;

  if (committed) {
    return (
      <div
        className="rounded-md border border-[var(--app-border-strong)] bg-[var(--app-panel-strong)] p-3"
        aria-live="polite"
      >
        <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--app-muted)]">
          Selected
        </div>
        <div className="mt-1 text-sm font-medium text-[var(--app-panel-text)]">
          {committed.label}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {question ? (
        <p className="text-sm text-[var(--app-panel-text)]">{question}</p>
      ) : null}
      <ul
        className="flex flex-col gap-2"
        role="radiogroup"
        aria-label={question ?? "Skill"}
      >
        {options.map((option) => {
          const isPicked = pickedId === option.id;
          return (
            <li key={option.id}>
              <button
                type="button"
                role="radio"
                aria-checked={isPicked}
                disabled={isBusy}
                onClick={() => setPickedId(option.id)}
                className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:opacity-60 disabled:cursor-not-allowed ${
                  isPicked
                    ? "border-[var(--app-border-strong)] bg-[var(--app-panel-strong)]"
                    : "border-[var(--app-border)] bg-[var(--app-panel-bg)] hover:border-[var(--app-border-strong)]"
                }`}
              >
                <span
                  className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    isPicked
                      ? "border-[var(--app-border-strong)] bg-[var(--color-primary)]"
                      : "border-[var(--app-border)] bg-[var(--app-panel-bg)]"
                  }`}
                  aria-hidden="true"
                >
                  {isPicked ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-on-primary)]" />
                  ) : null}
                </span>
                <span className="flex-1 text-sm text-[var(--app-panel-text)]">
                  {option.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {errorMessage ? (
        <p
          className="rounded-md border border-[var(--app-border-strong)] bg-[var(--app-danger-bg)] px-3 py-2 text-xs leading-snug text-[var(--app-danger-text)]"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="flex items-center justify-end pt-1">
        <button
          type="button"
          disabled={isBusy || !pickedId}
          onClick={handleSubmit}
          className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-[var(--app-text)] px-4 text-xs font-[580] text-[var(--app-bg)] outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 aria-hidden="true" className="animate-spin" size={14} />
              Submitting…
            </>
          ) : (
            "Submit"
          )}
        </button>
      </div>
    </div>
  );
}

function extractMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message && cause.message !== "submit_failed") {
    return cause.message;
  }
  return "Couldn't submit your selection. Please try again.";
}
