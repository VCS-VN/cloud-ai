import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
    isBusy || !pickedId || (pickedId === OTHER_ID && !customText.trim());

  if (committed) {
    return <CommittedView committed={committed} />;
  }

  return (
    <div className="question-card overflow-hidden rounded-lg border border-hairline bg-surface">
      {question ? (
        <div className="px-3.5 pb-2.5 pt-3">
          <p className="m-0 text-[13.5px] font-medium leading-snug text-ink">
            {question}
          </p>
        </div>
      ) : null}
      <div
        className="space-y-1.5 px-3.5 pb-3"
        role="radiogroup"
        aria-label={question ?? "Design style"}
      >
        {variants.map((variant, index) => {
          const isPicked = pickedId === variant.id;
          return (
            <Button
              key={variant.id}
              variant="unstyled"
              type="button"
              role="radio"
              aria-checked={isPicked}
              disabled={isBusy}
              onClick={() => setPickedId(variant.id)}
              className={cardClass(isPicked)}
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium leading-snug text-ink">
                    {variant.label}
                  </span>
                  {index === 0 || variant.id.toLowerCase().includes("recommended") ? (
                    <span className="inline-flex h-5 items-center rounded border border-success-fg/30 bg-success-bg px-1.5 font-mono text-[10px] font-medium uppercase tracking-wide text-success-fg">
                      Đề xuất
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">
                  {variant.description}
                </span>
              </span>
              <RadioDot picked={isPicked} />
            </Button>
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
            <span className="min-w-0 flex-1">
              <span className="text-sm font-medium leading-snug text-ink">
                Other
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">
                Describe the style you want
              </span>
              {pickedId === OTHER_ID ? (
                <Textarea
                  autoFocus
                  value={customText}
                  disabled={isBusy}
                  rows={3}
                  onChange={(e) => setCustomText(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3 w-full resize-none rounded-md border border-hairline bg-paper p-2 text-xs leading-relaxed text-ink placeholder:text-subtle focus-visible:border-ink focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-60"
                  placeholder="Describe your preferred option..."
                />
              ) : null}
            </span>
            <RadioDot picked={pickedId === OTHER_ID} />
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="px-3.5 pb-2.5">
          <p
            className="rounded-md border border-danger-bg bg-danger-bg px-3 py-2 text-xs leading-snug text-danger-fg"
            role="alert"
          >
            {errorMessage}
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-end border-t border-hairline bg-chalk px-3.5 py-2.5">
        <Button
          variant="unstyled"
          type="button"
          disabled={submitDisabled}
          onClick={handleSubmit}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ink px-3.5 text-[12.5px] font-medium text-paper outline-none transition-all duration-base hover:bg-deep active:translate-y-px focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-40"
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

function RadioDot({ picked }: { picked: boolean }) {
  return (
    <span
      className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-base ${
        picked ? "border-ink bg-ink text-paper" : "border-hairline bg-paper text-transparent"
      }`}
      aria-hidden="true"
    >
      {picked ? <Check size={10} strokeWidth={3} /> : null}
    </span>
  );
}

function cardClass(picked: boolean, isBusy = false): string {
  const base =
    "flex w-full items-start gap-3 rounded-md border p-3 text-left transition-all duration-base focus-visible:outline-none focus-visible:shadow-focus";
  const stateClass = picked
    ? "border-ink bg-chalk shadow-[inset_0_0_0_1px_rgb(var(--color-ink))]"
    : "border-hairline bg-surface hover:bg-chalk hover:border-hairline-soft";
  const disabledClass = isBusy
    ? "opacity-60 cursor-not-allowed"
    : "cursor-pointer";
  return `${base} ${stateClass} ${disabledClass}`;
}

function CommittedView({ committed }: { committed: Committed }) {
  return (
    <div
      className="rounded-lg border border-hairline bg-surface p-3.5"
      aria-live="polite"
    >
      <div className="font-mono text-[10px] font-medium uppercase tracking-wide text-muted">
        Selected
      </div>
      {committed.kind === "option" ? (
        <>
          <div className="mt-1 text-sm font-medium text-ink">
            {committed.label}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {committed.description}
          </p>
        </>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {committed.text}
        </p>
      )}
    </div>
  );
}
