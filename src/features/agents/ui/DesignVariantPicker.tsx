import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { DesignVariant } from "@/shared/project-types";

export type DesignVariantPickerProps = {
  question?: string;
  variants: DesignVariant[];
  onSelect: (optionId: string) => Promise<void> | void;
  onCustom?: (freeText: string) => Promise<void> | void;
  disabled?: boolean;
};

const OTHER_ID = "__other";

type Committed =
  | { kind: "option"; id: string; label: string; description: string }
  | { kind: "custom"; text: string };

export function DesignVariantPicker({
  question,
  variants,
  onSelect,
  onCustom,
  disabled,
}: DesignVariantPickerProps) {
  const [customText, setCustomText] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [committed, setCommitted] = useState<Committed | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!pickedId || submitting) return;
    setErrorMessage(null);
    if (pickedId === OTHER_ID) {
      const trimmed = customText.trim();
      if (!trimmed || !onCustom) return;
      setSubmitting(true);
      try {
        await onCustom(trimmed);
        setCommitted({ kind: "custom", text: trimmed });
      } catch (cause) {
        setErrorMessage(extractMessage(cause));
      } finally {
        setSubmitting(false);
      }
      return;
    }
    const picked = variants.find((v) => v.id === pickedId);
    if (!picked) return;
    setSubmitting(true);
    try {
      await onSelect(pickedId);
      setCommitted({
        kind: "option",
        id: picked.id,
        label: picked.label,
        description: picked.description,
      });
    } catch (cause) {
      setErrorMessage(extractMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const isBusy = disabled || submitting;
  const otherEnabled = Boolean(onCustom);
  const submitDisabled =
    isBusy ||
    !pickedId ||
    (pickedId === OTHER_ID && !customText.trim());

  if (committed) {
    return <CommittedView committed={committed} />;
  }

  return (
    <div className="space-y-3">
      {question ? (
        <p className="text-sm leading-snug text-[var(--app-panel-text)]">
          {question}
        </p>
      ) : null}
      <div
        className="flex flex-col gap-2"
        role="radiogroup"
        aria-label={question ?? "Design style"}
      >
        {variants.map((variant) => {
          const isPicked = pickedId === variant.id;
          return (
            <button
              key={variant.id}
              type="button"
              role="radio"
              aria-checked={isPicked}
              disabled={isBusy}
              onClick={() => setPickedId(variant.id)}
              className={cardClass(isPicked)}
            >
              <div className="flex items-start gap-3">
                <RadioDot picked={isPicked} />
                <div className="flex shrink-0 gap-1 pt-[2px]">
                  {variant.preview.palette.map((hex, idx) => (
                    <span
                      key={`${variant.id}-${idx}`}
                      className="inline-block h-4 w-4 rounded-full border border-[var(--app-border)]"
                      style={{ backgroundColor: hex }}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-[var(--app-panel-text)]">
                    {variant.label}
                  </div>
                  <p className="mt-1 text-xs leading-snug text-[var(--app-muted)]">
                    {variant.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}

        {otherEnabled ? (
          <div
            role="radio"
            aria-checked={pickedId === OTHER_ID}
            tabIndex={isBusy ? -1 : 0}
            onClick={() => !isBusy && setPickedId(OTHER_ID)}
            onKeyDown={(e) => {
              if (isBusy) return;
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                setPickedId(OTHER_ID);
              }
            }}
            className={cardClass(pickedId === OTHER_ID, isBusy)}
          >
            <div className="flex items-start gap-3">
              <RadioDot picked={pickedId === OTHER_ID} />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-[var(--app-panel-text)]">
                  Other
                </div>
                <p className="mt-1 text-xs leading-snug text-[var(--app-muted)]">
                  Describe the style you want
                </p>
                {pickedId === OTHER_ID ? (
                  <textarea
                    autoFocus
                    value={customText}
                    disabled={isBusy}
                    rows={2}
                    onChange={(e) => setCustomText(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 w-full resize-none rounded-md border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-2 text-xs text-[var(--app-panel-text)] placeholder:text-[var(--app-subtle-text)] focus-visible:border-[var(--app-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:opacity-60"
                    placeholder="e.g. bold tone, deep palette, daring typography."
                  />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

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
          disabled={submitDisabled}
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

function RadioDot({ picked }: { picked: boolean }) {
  return (
    <span
      className={`mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
        picked
          ? "border-[var(--app-border-strong)] bg-[var(--color-primary)]"
          : "border-[var(--app-border)] bg-[var(--app-panel-bg)]"
      }`}
      aria-hidden="true"
    >
      {picked ? (
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-on-primary)]" />
      ) : null}
    </span>
  );
}

function cardClass(picked: boolean, isBusy = false): string {
  const base =
    "block w-full text-left rounded-md border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]";
  const stateClass = picked
    ? "border-[var(--app-border-strong)] bg-[var(--app-panel-strong)]"
    : "border-[var(--app-border)] bg-[var(--app-panel-bg)] hover:border-[var(--app-border-strong)]";
  const disabledClass = isBusy ? "opacity-60 cursor-not-allowed" : "cursor-pointer";
  return `${base} ${stateClass} ${disabledClass}`;
}

function CommittedView({ committed }: { committed: Committed }) {
  return (
    <div
      className="rounded-md border border-[var(--app-border-strong)] bg-[var(--app-panel-strong)] p-3"
      aria-live="polite"
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--app-muted)]">
        Selected
      </div>
      {committed.kind === "option" ? (
        <>
          <div className="mt-1 text-sm font-medium text-[var(--app-panel-text)]">
            {committed.label}
          </div>
          <p className="mt-1 text-xs leading-snug text-[var(--app-muted)]">
            {committed.description}
          </p>
        </>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--app-panel-text)]">
          {committed.text}
        </p>
      )}
    </div>
  );
}
