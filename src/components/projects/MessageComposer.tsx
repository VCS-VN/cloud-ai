import {
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  CircleCheck,
  Clock,
  FilePlus2,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  Paperclip,
  Plus,
  Shield,
  Square,
  Wand2,
} from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { KNOWN_PAGES, GENERATE_PAGE_COMMAND } from "@/features/agents/codex/runtime/generate-page";
import type {
  ComposerReasoningEffort,
  TokenContext,
} from "@/shared/project-types";
import { TokenBar } from "./TokenBar";
import { ModelPicker } from "./ModelPicker";

type MessageComposerProps = {
  value: string;
  reasoningEffort: ComposerReasoningEffort;
  planMode: boolean;
  selectedModel: string | null;
  sending?: boolean;
  processing?: boolean;
  error?: string;
  disabled?: boolean;
  tokenContext?: TokenContext | null;
  /** Slugs of pages already authored by the AI — drives /generate-page badges. */
  generatedPageSlugs?: string[];
  onChange: (value: string) => void;
  onReasoningEffortChange: (value: ComposerReasoningEffort) => void;
  onPlanModeChange: (value: boolean) => void;
  onModelChange: (value: string) => void;
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

const ATTACH_ACTIONS: Array<{
  key: string;
  label: string;
  description: string;
  Icon: typeof ImageIcon;
}> = [
  {
    key: "attach",
    label: "Attach file",
    description: "Add a document for context",
    Icon: Paperclip,
  },
  {
    key: "image",
    label: "Image",
    description: "Upload a reference image",
    Icon: ImageIcon,
  },
  {
    key: "url",
    label: "Reference file/URL",
    description: "Link to a file or page",
    Icon: Link2,
  },
  {
    key: "hint",
    label: "Hint",
    description: "Guide the build with a hint",
    Icon: FileText,
  },
];

export function MessageComposer({
  value,
  reasoningEffort,
  planMode,
  selectedModel,
  sending = false,
  processing = false,
  error,
  disabled = false,
  tokenContext,
  generatedPageSlugs = [],
  onChange,
  onReasoningEffortChange,
  onPlanModeChange,
  onModelChange,
  onSend,
  onStop,
}: MessageComposerProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [effortOpen, setEffortOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const generatedSet = useMemo(
    () => new Set(generatedPageSlugs),
    [generatedPageSlugs],
  );
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

  // Open the /generate-page menu the moment the composer contains just a lone
  // "/" — the simplest, unambiguous trigger. Anything else closes it.
  function handleValueChange(next: string) {
    setValidationError(null);
    onChange(next);
    setPageMenuOpen(next === "/");
  }

  function insertGenerateCommand(slug: string | null) {
    const prefix = slug
      ? `${GENERATE_PAGE_COMMAND} ${slug} `
      : `${GENERATE_PAGE_COMMAND} `;
    setPageMenuOpen(false);
    onChange(prefix);
    // Restore focus + caret to the end so the user types their description next.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(prefix.length, prefix.length);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // While the page menu is open, let its own key handling (arrows/enter/esc)
    // take over — don't submit the form on Enter.
    if (pageMenuOpen) {
      if (event.key === "Escape") setPageMenuOpen(false);
      return;
    }
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
        <div
          role="tablist"
          aria-label="Mode"
          className="composer-mode-group shrink-0"
        >
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

        <div className="flex min-w-0 items-center gap-1">
          <ModelPicker
            selectedModel={selectedModel}
            disabled={sending || disabled}
            onModelChange={onModelChange}
          />
          <Popover open={effortOpen} onOpenChange={setEffortOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="unstyled"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={effortOpen}
              disabled={sending || disabled}
              className="composer-effort-trigger shrink-0"
            >
              <Clock aria-hidden="true" size={12} className="shrink-0" />
              <span className="hidden sm:inline">Reasoning:</span>{" "}
              <span className="text-ink">
                {EFFORT_META[reasoningEffort].label}
              </span>
              <ChevronDown
                aria-hidden="true"
                size={10}
                className="shrink-0 text-subtle"
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
      </div>

      {/* Textarea */}
      <label className="sr-only" htmlFor="project-message">
        Enter message
      </label>
      <div className="px-3 pt-3">
        <Popover open={pageMenuOpen} onOpenChange={setPageMenuOpen}>
          <PopoverAnchor asChild>
            <Textarea
              id="project-message"
              ref={textareaRef}
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
              onChange={(event) => handleValueChange(event.target.value)}
              onKeyDown={handleKeyDown}
            />
          </PopoverAnchor>
          <PageCommandMenu
            generatedSet={generatedSet}
            onSelectPage={insertGenerateCommand}
          />
        </Popover>
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
        <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="unstyled"
              type="button"
              aria-haspopup="menu"
              aria-expanded={actionsOpen}
              aria-label="Add attachment or hint"
              disabled={sending || disabled}
              className="composer-icon-btn"
            >
              <Plus aria-hidden="true" size={16} />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={6} className="w-60 p-1" role="menu">
            {ATTACH_ACTIONS.map(({ key, label, description, Icon }) => (
              <Button
                key={key}
                variant="unstyled"
                type="button"
                role="menuitem"
                title={`${label} — coming soon`}
                disabled
                className="composer-effort-option opacity-60"
              >
                <Icon
                  aria-hidden="true"
                  size={16}
                  className="mt-0.5 shrink-0 text-subtle"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-ui-sm font-medium text-ink">
                    {label}
                  </span>
                  <span className="block text-eyebrow text-muted">
                    {description}
                  </span>
                </span>
              </Button>
            ))}
          </PopoverContent>
        </Popover>

        <div className="flex min-w-0 items-center gap-2">
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

const PAGE_DESCRIPTIONS: Record<string, string> = {
  home: "Landing page — hero, catalog, calls to action",
  products: "Catalog grid with categories and filters",
  "product-detail": "Single product — gallery, price, add to cart",
  cart: "Cart line items and subtotal",
  checkout: "Shipping form and mock order placement",
  orders: "Order history list",
  "order-detail": "Single order summary and line items",
};

function PageCommandMenu({
  generatedSet,
  onSelectPage,
}: {
  generatedSet: Set<string>;
  onSelectPage: (slug: string | null) => void;
}) {
  return (
    <PopoverContent
      align="start"
      side="top"
      sideOffset={8}
      className="w-[min(22rem,calc(100vw-2rem))] p-0"
      onOpenAutoFocus={(event) => event.preventDefault()}
    >
      <Command className="bg-surface">
        <CommandInput placeholder="Generate a page…" className="text-ui-sm" />
        <CommandList>
          <CommandEmpty>No matching page.</CommandEmpty>
          <CommandGroup heading="Storefront pages">
            {KNOWN_PAGES.map((page) => {
              const designed = generatedSet.has(page.slug);
              return (
                <CommandItem
                  key={page.slug}
                  value={`${page.slug} ${page.label}`}
                  onSelect={() => onSelectPage(page.slug)}
                  className="gap-3 py-2"
                >
                  {designed ? (
                    <CircleCheck aria-hidden="true" size={16} className="shrink-0 text-ink" />
                  ) : (
                    <Circle aria-hidden="true" size={16} className="shrink-0 text-subtle" />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-ui-sm font-medium text-ink">
                      {page.label}
                    </span>
                    <span className="truncate text-eyebrow text-muted">
                      {PAGE_DESCRIPTIONS[page.slug] ?? page.route}
                    </span>
                  </span>
                  <span className="shrink-0 text-eyebrow text-subtle">
                    {designed ? "Designed" : "Skeleton"}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
          <CommandGroup heading="Something else">
            <CommandItem
              value="custom new page"
              onSelect={() => onSelectPage(null)}
              className="gap-3 py-2"
            >
              <FilePlus2 aria-hidden="true" size={16} className="shrink-0 text-muted" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-ui-sm font-medium text-ink">
                  Custom page
                </span>
                <span className="truncate text-eyebrow text-muted">
                  Describe a page that isn't in the list
                </span>
              </span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  );
}
