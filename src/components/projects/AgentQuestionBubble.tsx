import { useReducer } from "react";
import type { DesignVariant, Message } from "@/shared/project-types";

type AgentQuestionBubbleProps = {
  message: Message;
  onSelectOption?: (messageId: string, optionId: string) => Promise<void>;
};

/** Renders motion level as dot indicators 1-10 */
function MotionIndicator({ level }: { level: number }) {
  const dots = Array.from({ length: 10 }, (_, i) => (
    <span
      key={i}
      className={`inline-block h-[6px] w-[6px] rounded-full ${
        i < level ? "bg-[var(--app-accent)]" : "bg-[var(--app-border)]"
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
      <div className="text-[12px] text-[var(--app-icon-muted)] italic">
        (Không có gợi ý nào để hiển thị)
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
      <div className="flex flex-col gap-xs">
        <p className="text-[11px] text-[var(--app-icon-muted)]">
          Chọn các trang bạn muốn thêm:
        </p>
        {variants.map((variant) => {
          const checked = toggles[variant.id] ?? true;
          return (
            <label
              key={variant.id}
              className={`flex items-center gap-xs rounded-md border p-sm transition-all ${
                canToggle
                  ? "cursor-pointer border-[var(--app-border-soft)] bg-[var(--app-panel-bg)] hover:border-[var(--app-border-strong)]"
                  : "cursor-default border-[var(--app-border)] opacity-60"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={!canToggle}
                onChange={() => toggleDispatch({ type: "toggle", optionId: variant.id })}
                className="accent-[var(--app-accent)]"
              />
              <div className="flex-1">
                <span className="text-[12px] font-medium text-[var(--app-panel-text)]">
                  {variant.label}
                </span>
                <p className="text-[11px] text-[var(--app-icon-muted)]">
                  {variant.description}
                </p>
              </div>
            </label>
          );
        })}
        {canToggle && (
          <button
            type="button"
            disabled={!!selecting}
            onClick={handleConfirmPages}
            className="mt-xs w-full rounded-pill border border-[var(--app-accent)] bg-[var(--app-accent)] px-sm py-xxs text-[12px] font-semibold text-[var(--app-panel-bg)] transition-all hover:opacity-90 disabled:opacity-50"
          >
            {selecting ? "Đang xác nhận..." : "Xác nhận các trang đã chọn"}
          </button>
        )}
      </div>
    );
  }

  // Original: radio-style design variant cards
  return (
    <div className="flex flex-col gap-xs">
      {variants.map((variant) => {
        const isSelected = selectedOptionId === variant.id;
        const isSelecting = selecting === variant.id;
        const dimmed = !!selectedOptionId && !isSelected;

        return (
          <button
            key={variant.id}
            type="button"
            disabled={!!selectedOptionId || !!selecting}
            onClick={() => handleRadioClick(variant.id)}
            className={`w-full rounded-md border p-sm text-left transition-all duration-200 ${
              isSelected
                ? "border-[var(--app-accent)] bg-[var(--app-selected-bg)]"
                : dimmed
                  ? "border-[var(--app-border)] opacity-40"
                  : "border-[var(--app-border-soft)] bg-[var(--app-panel-bg)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-control)]"
            } ${selecting ? "cursor-wait" : selectedOptionId ? "cursor-default" : "cursor-pointer"}`}
            aria-pressed={isSelected}
            aria-label={`${variant.label}: ${variant.description}`}
          >
            <div className="mb-xxs flex items-center justify-between">
              <span className="text-[12px] font-semibold text-[var(--app-panel-text)]">
                {variant.label}
              </span>
              <span
                className="text-[10px] font-medium text-[var(--app-icon-muted)]"
                style={{ fontFamily: variant.preview.font }}
              >
                {variant.preview.font}
              </span>
            </div>

            <p className="mb-xs text-[11px] leading-[1.35] text-[var(--app-icon-muted)]">
              {variant.description}
            </p>

            {/* Color swatches */}
            <div className="mb-xs flex items-center gap-[4px]">
              {variant.preview.palette.map((hex) => (
                <span
                  key={hex}
                  className="h-[18px] w-[18px] rounded-sm border border-[var(--app-border)]"
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
              <span className="ml-xs">
                <MotionIndicator level={variant.preview.motion} />
              </span>
            </div>

            {isSelected && (
              <div className="mt-xxs text-[11px] font-medium text-[var(--app-accent)]">
                Bạn đã chọn: {variant.label}
              </div>
            )}
            {isSelecting && (
              <div className="mt-xxs text-[11px] text-[var(--app-icon-muted)]">
                Đang chọn...
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
