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
    <div className="flex flex-col gap-2">
      <p className="whitespace-pre-wrap text-[12px] leading-[1.4] text-ink">
        {message.content}
      </p>

      {hasOptions ? (
        <div className="flex flex-col gap-2">
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
                className={`w-full rounded-md border p-3 text-left transition-all duration-200 ${
                  isSelected
                    ? "border-ink bg-ink/[0.06] text-ink"
                    : dimmed
                      ? "border-hairline text-ink opacity-50"
                      : "border-hairline bg-surface text-ink hover:border-hairline-soft hover:bg-ink/[0.03]"
                } ${disabled ? "cursor-default" : "cursor-pointer"}`}
                aria-pressed={isSelected}
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[12px] font-semibold">
                        {option.label}
                      </span>
                      {option.recommended ? (
                        <span className="inline-flex items-center gap-[3px] rounded-pill border border-hairline px-1.5 py-[1px] text-[10px] font-medium text-muted">
                          <Sparkles aria-hidden="true" size={10} />
                          Recommended
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] leading-[1.35] text-muted">
                      {option.description}
                    </p>
                  </div>
                  {isSelected ? (
                    <CheckCircle2
                      aria-hidden="true"
                      className="shrink-0 text-ink"
                      size={16}
                    />
                  ) : isSelecting ? (
                    <Loader2
                      aria-hidden="true"
                      className="shrink-0 animate-spin text-muted"
                      size={16}
                    />
                  ) : null}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <OptionList title="Pros" items={option.pros} />
                  <OptionList title="Cons" items={option.cons} />
                </div>
              </Button>
            );
          })}
          {metadata.customAnswerAllowed !== false ? (
            <p className="text-[11px] italic text-muted">
              You can still type your own answer instead of choosing an option.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-[11px] italic text-muted">
          Reply with a new message to continue.
        </p>
      )}
    </div>
  );
}

function OptionList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded border border-hairline bg-ink/[0.03] p-2">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
        {title}
      </div>
      <ul className="m-0 flex list-disc flex-col gap-1 pl-3 text-[11px] leading-[1.35] text-ink">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
