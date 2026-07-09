import { useReducer } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { DesignVariant, Message } from "@/shared/project-types";

type AgentQuestionBubbleProps = {
  message: Message;
  onSelectOption?: (messageId: string, optionId: string) => Promise<boolean | void>;
};

/** Renders motion level as dot indicators 1-10 */
function MotionIndicator({ level }: { level: number }) {
  const dots = Array.from({ length: 10 }, (_, i) => (
    <span
      key={i}
      className={`inline-block h-[6px] w-[6px] rounded-full ${
        i < level ? "bg-ink" : "bg-hairline-soft"
      }`}
    />
  ));
  return (
    <div className="flex items-center gap-[3px]" aria-label={`Motion: ${level}/10`}>
      {dots}
    </div>
  );
}

// T048: toggle state for optional page multi-select
type ToggleState = Record<string, boolean>;

type ToggleAction =
  | { type: "toggle"; optionId: string }
  | { type: "reset"; optionIds: string[] };

function toggleReducer(state: ToggleState, action: ToggleAction): ToggleState {
  switch (action.type) {
    case "toggle":
      return { ...state, [action.optionId]: !state[action.optionId] };
    case "reset":
      return Object.fromEntries(action.optionIds.map((id) => [id, true]));
    default:
      return state;
  }
}

export function AgentQuestionBubble({ message, onSelectOption }: AgentQuestionBubbleProps) {
  const metadata = message.metadata;
  const [selecting, setSelecting] = useReducer(
    (s: string | null, v: string | null) => v,
    null,
  );
  const isCheckbox = metadata?.questionType === "optional_pages";

  // T048: toggle state for checkbox-style multi-select
  const [toggles, toggleDispatch] = useReducer(
    toggleReducer,
    {},
    () => {
      const options = (metadata?.options as DesignVariant[]) ?? [];
      return Object.fromEntries(options.map((o) => [o.id, true]));
    },
  );

  if (!metadata?.options?.length) {
    return (
      <div className="text-[12px] text-muted italic">
        (No suggestions to display)
      </div>
    );
  }

  const selectedOptionId = metadata.selectedOptionId;
  const variants = metadata.options as DesignVariant[];

  const handleRadioClick = async (optionId: string) => {
    if (selectedOptionId || selecting) return;
    if (!onSelectOption) return;
    setSelecting(optionId);
    try {
      await onSelectOption(message.id, optionId);
    } catch {
      setSelecting(null);
    }
  };

  const handleConfirmPages = async () => {
    if (!onSelectOption) return;
    // Gather selected page IDs, join as compound value
    const selectedIds = Object.entries(toggles)
      .filter(([, on]) => on)
      .map(([id]) => id)
      .join(",");
    if (!selectedIds) return;
    setSelecting(selectedIds);
    try {
      await onSelectOption(message.id, selectedIds);
    } catch {
      setSelecting(null);
    }
  };

  const canToggle = isCheckbox && !selectedOptionId;

  // T048: checkbox-style for optional pages
  if (isCheckbox) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[11px] text-muted">
          Select pages you want to add:
        </p>
        {variants.map((variant) => {
          const checked = toggles[variant.id] ?? true;
          return (
            <label
              key={variant.id}
              className={`flex items-center gap-2 rounded-md border p-3 transition-all ${
                canToggle
                  ? "cursor-pointer border-hairline bg-surface hover:border-hairline-soft"
                  : "cursor-default border-hairline opacity-60"
              }`}
            >
              <Checkbox
                checked={checked}
                disabled={!canToggle}
                onChange={() => toggleDispatch({ type: "toggle", optionId: variant.id })}
                className="accent-ink"
              />
              <div className="flex-1">
                <span className="text-[12px] font-medium text-ink">
                  {variant.label}
                </span>
                <p className="text-[11px] text-muted">
                  {variant.description}
                </p>
              </div>
            </label>
          );
        })}
        {canToggle && (
          <Button
            variant="unstyled"
            type="button"
            disabled={!!selecting}
            onClick={handleConfirmPages}
            className="mt-1 w-full rounded-pill border border-ink bg-ink px-3 py-1 text-[12px] font-semibold text-paper transition-all hover:opacity-90 disabled:opacity-50"
          >
            {selecting ? "Confirming..." : "Confirm selected pages"}
          </Button>
        )}
      </div>
    );
  }

  // Original: radio-style design variant cards
  return (
    <div className="flex flex-col gap-2">
      {variants.map((variant) => {
        const isSelected = selectedOptionId === variant.id;
        const isSelecting = selecting === variant.id;
        const dimmed = !!selectedOptionId && !isSelected;

        return (
          <Button
            key={variant.id}
            variant="unstyled"
            type="button"
            disabled={!!selectedOptionId || !!selecting}
            onClick={() => handleRadioClick(variant.id)}
            className={`w-full rounded-md border p-3 text-left transition-all duration-200 ${
              isSelected
                ? "border-ink bg-ink/[0.06]"
                : dimmed
                  ? "border-hairline opacity-40"
                  : "border-hairline bg-surface hover:border-hairline-soft hover:bg-ink/[0.03]"
            } ${selecting ? "cursor-wait" : selectedOptionId ? "cursor-default" : "cursor-pointer"}`}
            aria-pressed={isSelected}
            aria-label={`${variant.label}: ${variant.description}`}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-ink">
                {variant.label}
              </span>
              <span
                className="text-[10px] font-medium text-muted"
                style={{ fontFamily: variant.preview.font }}
              >
                {variant.preview.font}
              </span>
            </div>

            <p className="mb-2 text-[11px] leading-[1.35] text-muted">
              {variant.description}
            </p>

            {/* Color swatches */}
            <div className="mb-2 flex items-center gap-[4px]">
              {variant.preview.palette.map((hex) => (
                <span
                  key={hex}
                  className="h-[18px] w-[18px] rounded-sm border border-hairline"
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
              <span className="ml-2">
                <MotionIndicator level={variant.preview.motion} />
              </span>
            </div>

            {isSelected && (
              <div className="mt-1 text-[11px] font-medium text-ink">
                You selected: {variant.label}
              </div>
            )}
            {isSelecting && (
              <div className="mt-1 text-[11px] text-muted">
                Selecting...
              </div>
            )}
          </Button>
        );
      })}
    </div>
  );
}
