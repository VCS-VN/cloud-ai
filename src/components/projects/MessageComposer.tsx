import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  Paperclip,
  Shield,
  Square,
  Wand2,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type {
  ComposerReasoningEffort,
  TokenContext,
} from "@/shared/project-types";
import { TokenBar } from "./TokenBar";

type MessageComposerProps = {
  value: string;
  reasoningEffort: ComposerReasoningEffort;
  planMode: boolean;
  sending?: boolean;
  processing?: boolean;
  error?: string;
  disabled?: boolean;
  tokenContext?: TokenContext | null;
  onChange: (value: string) => void;
  onReasoningEffortChange: (value: ComposerReasoningEffort) => void;
  onPlanModeChange: (value: boolean) => void;
  onSend: (value: string) => Promise<void> | void;
  onStop?: () => Promise<void> | void;
  onScrollMessagesUp?: () => void;
  onScrollMessagesDown?: () => void;
};

export const MAX_PROJECT_MESSAGE_LENGTH = 12000;

export function validateProjectMessageInput(value: string) {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) return "Enter a prompt before sending.";
  if (trimmedValue.length > MAX_PROJECT_MESSAGE_LENGTH) {
    return `Prompt must be ${MAX_PROJECT_MESSAGE_LENGTH.toLocaleString()} characters or fewer.`;
  }
  return null;
}

const EFFORT_META: Record<
  ComposerReasoningEffort,
  { label: string; bar: string; description: string }
> = {
  low: {
    label: "Low",
    bar: "bg-ink/30",
    description: "Fast response, minimal reasoning. Good for small tweaks.",
  },
  medium: {
    label: "Medium",
    bar: "bg-ink/60",
    description: "Balanced speed and quality. Default.",
  },
  high: {
    label: "High",
    bar: "bg-ink",
    description: "Deep reasoning, multi-step. ~2-3× slower.",
  },
  xhigh: {
    label: "Extreme",
    bar: "bg-ink",
    description: "Maximum reasoning. ~5× slower, for complex tasks.",
  },
};

const EFFORT_OPTIONS: ComposerReasoningEffort[] = [
  "low",
  "medium",
  "high",
  "xhigh",
];

const ATTACH_BUTTONS: Array<{
  key: string;
  label: string;
  Icon: typeof ImageIcon;
}> = [
  { key: "attach", label: "Attach", Icon: Paperclip },
  { key: "image", label: "Image", Icon: ImageIcon },
  { key: "url", label: "Reference file/url", Icon: Link2 },
];

export function MessageComposer({
  value,
  reasoningEffort,
  planMode,
  sending = false,
  processing = false,
  error,
  disabled = false,
  tokenContext,
  onChange,
  onReasoningEffortChange,
  onPlanModeChange,
  onSend,
  onStop,
}: MessageComposerProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [effortOpen, setEffortOpen] = useState(false);
  const inputValidationError = useMemo(
    () => validateProjectMessageInput(value),
    [value],
  );
  const canSend = !inputValidationError && !sending && !disabled;
  const canStop = processing && !sending && !!onStop;
  const displayedError = validationError ?? error;
  const placeholder = planMode
    ? "Describe your goal — Cloud AI will plan before building..."
    : "Describe the next change... (Cmd + Enter to send)";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inputValidationError) {
      setValidationError(inputValidationError);
      return;
    }
    if (!canSend) return;
    setValidationError(null);
    await onSend(value.trim());
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      (event.metaKey || event.ctrlKey || !event.shiftKey)
    ) {
      // Cmd/Ctrl+Enter or plain Enter (without Shift) submits
      event.preventDefault();
      if (canSend) {
        event.currentTarget.form?.requestSubmit();
      }
    }
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      {/* Top row: mode toggle + reasoning effort */}
      <div className="flex items-center justify-between gap-2 border-b border-hairline/70 px-2.5 pb-1 pt-2">
        <div role="tablist" aria-label="Mode" className="composer-mode-group">
          <Button
            variant="unstyled"
            type="button"
            role="tab"
            aria-selected={!planMode}
            disabled={sending || disabled}
            onClick={() => onPlanModeChange(false)}
            className={`composer-mode-btn ${!planMode ? "composer-mode-btn-active" : ""}`}
          >
            <Shield aria-hidden="true" size={12} />
            Build
          </Button>
          <Button
            variant="unstyled"
            type="button"
            role="tab"
            aria-selected={planMode}
            disabled={sending || disabled}
            onClick={() => onPlanModeChange(true)}
            className={`composer-mode-btn ${planMode ? "composer-mode-btn-active" : ""}`}
          >
            <Wand2 aria-hidden="true" size={12} />
            Plan
          </Button>
        </div>

        <Popover open={effortOpen} onOpenChange={setEffortOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="unstyled"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={effortOpen}
              disabled={sending || disabled}
              className="composer-effort-trigger"
            >
              <Clock aria-hidden="true" size={12} />
              Reasoning:{" "}
              <span className="text-ink">
                {EFFORT_META[reasoningEffort].label}
              </span>
              <ChevronDown
                aria-hidden="true"
                size={10}
                className="text-subtle"
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-56 p-1"
            role="listbox"
          >
            {EFFORT_OPTIONS.map((option) => {
              const meta = EFFORT_META[option];
              const active = option === reasoningEffort;
              return (
                <Button
                  key={option}
                  variant="unstyled"
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onReasoningEffortChange(option);
                    setEffortOpen(false);
                  }}
                  className={`composer-effort-option ${active ? "composer-effort-option-active" : ""}`}
                >
                  <span className={`composer-effort-bar ${meta.bar}`} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-ui-sm font-medium text-ink inline-flex items-center gap-1.5">
                      {meta.label}
                      {active ? (
                        <Check
                          aria-hidden="true"
                          size={12}
                          className="text-success-fg"
                        />
                      ) : null}
                    </span>
                    <span className="block text-eyebrow text-muted">
                      {meta.description}
                    </span>
                  </span>
                </Button>
              );
            })}
          </PopoverContent>
        </Popover>
      </div>

      {/* Textarea */}
      <label className="sr-only" htmlFor="project-message">
        Enter message
      </label>
      <div className="px-3 pt-3">
        <Textarea
          id="project-message"
          className="w-full bg-transparent border-0 outline-none p-0
                     text-body leading-relaxed text-ink
                     placeholder:text-subtle
                     resize-none min-h-[96px] max-h-[260px] overflow-y-auto
                     focus-visible:shadow-none"
          value={value}
          placeholder={placeholder}
          disabled={sending || disabled}
          maxLength={MAX_PROJECT_MESSAGE_LENGTH}
          aria-invalid={!!displayedError}
          onChange={(event) => {
            setValidationError(null);
            onChange(event.target.value);
          }}
          onKeyDown={handleKeyDown}
        />
      </div>

      {displayedError ? (
        <div className="px-3 pb-2">
          <p
            className="rounded-md border border-hairline bg-danger-bg p-2 text-ui-sm text-danger-fg"
            role="alert"
            aria-live="assertive"
          >
            {displayedError}
          </p>
        </div>
      ) : null}

      {/* Bottom row: attachments + send */}
      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <div className="flex items-center gap-0.5">
          {ATTACH_BUTTONS.map(({ key, label, Icon }) => (
            <Button
              key={key}
              variant="unstyled"
              type="button"
              className="composer-icon-btn"
              aria-label={label}
              title={`${label} — coming soon`}
              disabled
            >
              <Icon aria-hidden="true" size={14} />
            </Button>
          ))}
          <Button
            variant="unstyled"
            type="button"
            className="composer-icon-btn px-2 w-auto h-7 text-eyebrow font-medium"
            title="Hint — coming soon"
            disabled
          >
            <FileText aria-hidden="true" size={12} />
            <span>Hint</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <TokenBar tokenContext={tokenContext ?? null} />
          {canStop ? (
            <Button
              variant="unstyled"
              type="button"
              onClick={() => void onStop?.()}
              aria-label="Stop generating"
              className="composer-stop"
            >
              <Square aria-hidden="true" size={12} />
              Stop
            </Button>
          ) : null}
          <Button
            variant="unstyled"
            type="submit"
            disabled={!canSend}
            aria-label={sending ? "Sending message..." : "Send message"}
            aria-busy={sending}
            className="composer-send"
          >
            {sending ? (
              <Loader2 aria-hidden="true" className="animate-spin" size={14} />
            ) : (
              <>
                <span>{planMode ? "Plan" : "Send"}</span>
                <ArrowRight aria-hidden="true" size={14} />
              </>
            )}
          </Button>
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
