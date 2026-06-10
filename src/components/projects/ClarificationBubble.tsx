import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useReducer } from "react";
import { Button } from "@/components/ui/button";
import type { Message } from "@/shared/project-types";

type ClarificationBubbleProps = {
  message: Message;
  onSelectOption?: (messageId: string, optionId: string) => Promise<boolean | void>;
};

export function ClarificationBubble({
  message,
  onSelectOption,
}: ClarificationBubbleProps) {
  const metadata = message.metadata;
  const [selecting, setSelecting] = useReducer(
    (_state: string | null, value: string | null) => value,
    null,
  );
  const hasOptions =
    metadata?.questionType === "clarification_options" &&
    metadata.options.length > 0;

  const handleSelect = async (optionId: string) => {
    if (!hasOptions || metadata.selectedOptionId || selecting || !onSelectOption)
      return;
    setSelecting(optionId);
    try {
      await onSelectOption(message.id, optionId);
    } catch {
      setSelecting(null);
    }
  };

  return (
    <div className="flex flex-col gap-xs">
      <p className="whitespace-pre-wrap text-[12px] leading-[1.4] text-[var(--app-panel-text)]">
        {message.content}
      </p>

      {hasOptions ? (
        <div className="flex flex-col gap-xs">
          {metadata.options.map((option) => {
            const isSelected = metadata.selectedOptionId === option.id;
            const isSelecting = selecting === option.id;
            const disabled = Boolean(
              metadata.selectedOptionId || selecting || !onSelectOption,
            );
            const dimmed = Boolean(metadata.selectedOptionId && !isSelected);

            return (
              <Button
                key={option.id}
                variant="unstyled"
                type="button"
                disabled={disabled}
                onClick={() => handleSelect(option.id)}
                className={`w-full rounded-md border p-sm text-left transition-all duration-200 ${
                  isSelected
                    ? "border-[var(--app-accent)] bg-[var(--app-selected-bg)] text-[var(--app-selected-text)]"
                    : dimmed
                      ? "border-[var(--app-border)] opacity-50"
                      : "border-[var(--app-border-soft)] bg-[var(--app-panel-bg)] text-[var(--app-panel-text)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-control)]"
                } ${disabled ? "cursor-default" : "cursor-pointer"}`}
                aria-pressed={isSelected}
              >
                <div className="mb-xxs flex items-start justify-between gap-xs">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-xxs">
                      <span className="text-[12px] font-semibold">
                        {option.label}
                      </span>
                      {option.recommended ? (
                        <span className="inline-flex items-center gap-[3px] rounded-pill border border-[var(--app-border)] px-xxs py-[1px] text-[10px] font-medium text-[var(--app-icon)]">
                          <Sparkles aria-hidden="true" size={10} />
                          Recommended
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-xxs text-[11px] leading-[1.35] text-[var(--app-icon-muted)]">
                      {option.description}
                    </p>
                  </div>
                  {isSelected ? (
                    <CheckCircle2
                      aria-hidden="true"
                      className="shrink-0 text-[var(--app-accent)]"
                      size={16}
                    />
                  ) : isSelecting ? (
                    <Loader2
                      aria-hidden="true"
                      className="shrink-0 animate-spin text-[var(--app-icon)]"
                      size={16}
                    />
                  ) : null}
                </div>

                <div className="grid gap-xs sm:grid-cols-2">
                  <OptionList title="Pros" items={option.pros} />
                  <OptionList title="Cons" items={option.cons} />
                </div>
              </Button>
            );
          })}
          {metadata.customAnswerAllowed !== false ? (
            <p className="text-[11px] italic text-[var(--app-icon-muted)]">
              You can still type your own answer instead of choosing an option.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-[11px] italic text-[var(--app-icon-muted)]">
          Reply with a new message to continue.
        </p>
      )}
    </div>
  );
}

function OptionList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-sm border border-[var(--app-border-soft)] bg-[var(--app-control)] p-xs">
      <div className="mb-xxs text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--app-icon-muted)]">
        {title}
      </div>
      <ul className="m-0 flex list-disc flex-col gap-xxs pl-sm text-[11px] leading-[1.35] text-[var(--app-panel-text)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
