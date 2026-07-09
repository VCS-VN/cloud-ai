import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [committed, setCommitted] = useState<SkillClarificationOption | null>(
    null,
  );
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
        className="rounded-md border border-hairline-soft bg-ink/[0.06] p-3"
        aria-live="polite"
      >
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Selected
        </div>
        <div className="mt-1 text-sm font-medium text-ink">
          {committed.label}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {question ? (
        <p className="text-sm text-ink">{question}</p>
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
              <Button
                variant="unstyled"
                type="button"
                role="radio"
                aria-checked={isPicked}
                disabled={isBusy}
                onClick={() => setPickedId(option.id)}
                className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 disabled:opacity-60 disabled:cursor-not-allowed ${
                  isPicked
                    ? "border-hairline-soft bg-ink/[0.06]"
                    : "border-hairline bg-surface hover:border-hairline-soft"
                }`}
              >
                <span
                  className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    isPicked
                      ? "border-ink bg-ink"
                      : "border-hairline bg-surface"
                  }`}
                  aria-hidden="true"
                >
                  {isPicked ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-paper" />
                  ) : null}
                </span>
                <span className="flex-1 text-sm text-ink">
                  {option.label}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>

      {errorMessage ? (
        <p
          className="rounded-md border border-hairline bg-danger-bg px-3 py-2 text-xs leading-snug text-danger-fg"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="flex items-center justify-end pt-1">
        <Button
          variant="unstyled"
          type="button"
          disabled={isBusy || !pickedId}
          onClick={handleSubmit}
          className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-ink px-4 text-xs font-[580] text-paper outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ink/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 aria-hidden="true" className="animate-spin" size={14} />
              Submitting…
            </>
          ) : (
            "Submit"
          )}
        </Button>
      </div>
    </div>
  );
}

function extractMessage(cause: unknown): string {
  if (
    cause instanceof Error &&
    cause.message &&
    cause.message !== "submit_failed"
  ) {
    return cause.message;
  }
  return "Couldn't submit your selection. Please try again.";
}
