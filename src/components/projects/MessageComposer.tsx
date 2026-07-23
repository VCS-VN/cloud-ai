import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  Clock,
  FilePlus2,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  Paperclip,
  PencilRuler,
  Plus,
  Shield,
  Square,
  Wand2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { KNOWN_PAGES, GENERATE_PAGE_COMMAND } from "@/features/agents/codex/runtime/generate-page";
import { REDESIGN_COMMAND } from "@/features/agents/codex/runtime/redesign";
import type {
  ComposerReasoningEffort,
  TokenContext,
} from "@/shared/project-types";
import { TokenBar } from "./TokenBar";
import { ModelPicker } from "./ModelPicker";
import { EpisCloudBlockedNotice } from "@/components/profile/EpisCloudBlockedNotice";

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
  /** When true, the build was blocked because Epis Cloud isn't activated yet. */
  episCloudBlocked?: boolean;
  /** Opens the Epis Cloud activation dialog from the blocking notice CTA. */
  onActivateClick?: () => void;
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
  episCloudBlocked = false,
  onActivateClick,
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
  // The slash menu closes on Escape even while the input still holds a partial
  // command, so its open state is tracked separately from the derived context.
  const [menuDismissed, setMenuDismissed] = useState(false);
  // Index of the highlighted suggestion — drives ↑/↓ navigation and which entry
  // Tab/Enter completes. Reset to 0 whenever the suggestion list changes.
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const generatedSet = useMemo(
    () => new Set(generatedPageSlugs),
    [generatedPageSlugs],
  );

  // Everything about the slash UI is derived from the current input value, so
  // typing and clicking stay perfectly consistent (no separate menu-level
  // state to drift out of sync).
  const slashContext = useMemo(() => parseSlashContext(value), [value]);
  const suggestions = useMemo(
    () => buildSuggestions(slashContext, generatedSet),
    [slashContext, generatedSet],
  );
  const menuOpen = !menuDismissed && suggestions.length > 0;
  const activeSuggestion = suggestions[activeIndex] ?? suggestions[0] ?? null;
  // Ghost-text suffix: the part of the active suggestion's insert value that
  // extends past what the user has already typed. Only shown when it's a real
  // forward-completion of the current input.
  const ghostSuffix = useMemo(() => {
    if (!menuOpen || !activeSuggestion) return "";
    const insert = activeSuggestion.insert;
    if (insert.length <= value.length) return "";
    if (!insert.toLowerCase().startsWith(value.toLowerCase())) return "";
    return insert.slice(value.length);
  }, [menuOpen, activeSuggestion, value]);

  // A fresh suggestion list means the old highlight index may be stale.
  useEffect(() => {
    setActiveIndex(0);
  }, [slashContext?.mode, slashContext?.query]);
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

  function handleValueChange(next: string) {
    setValidationError(null);
    onChange(next);
    // Any edit re-arms the menu: a dismissal only suppresses the current keystroke.
    setMenuDismissed(false);
  }

  // Apply a suggestion's insert text to the composer and drop the caret at the
  // end so the user keeps typing their description. Shared by click, Tab, and
  // Enter so all three behave identically.
  function applySuggestion(suggestion: Suggestion) {
    const next = suggestion.insert;
    onChange(next);
    setMenuDismissed(false);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.length, next.length);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // While the slash menu is open, its keys (↑/↓/Tab/Enter/Esc) take over.
    if (menuOpen) {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setActiveIndex((i) => (i + 1) % suggestions.length);
          return;
        case "ArrowUp":
          event.preventDefault();
          setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
          return;
        case "Tab":
          // Tab always autocompletes to the highlighted suggestion rather than
          // moving focus — the whole point of the inline hint.
          event.preventDefault();
          if (activeSuggestion) applySuggestion(activeSuggestion);
          return;
        case "Enter":
          // Plain Enter accepts the suggestion; Shift+Enter falls through to a
          // newline. Only intercept when there's a real completion pending so a
          // fully-typed command can still be sent with Enter.
          if (!event.shiftKey && activeSuggestion && ghostSuffix) {
            event.preventDefault();
            applySuggestion(activeSuggestion);
            return;
          }
          break;
        case "Escape":
          event.preventDefault();
          setMenuDismissed(true);
          return;
        default:
          break;
      }
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
      <div className="composer-toolbar">
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

        <div className="composer-toolbar-controls">
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
              <span className="composer-effort-label">Reasoning:</span>{" "}
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
        <Popover open={menuOpen} onOpenChange={(open) => setMenuDismissed(!open)}>
          <PopoverAnchor asChild>
            {/* Relative wrapper positions the ghost-text overlay exactly behind
                the textarea so the completion suffix aligns with the caret. */}
            <div className="relative">
              {ghostSuffix ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words
                             text-body leading-relaxed"
                >
                  <span className="invisible">{value}</span>
                  <span className="text-subtle">{ghostSuffix}</span>
                </div>
              ) : null}
              <Textarea
                id="project-message"
                ref={textareaRef}
                className="relative w-full bg-transparent border-0 outline-none p-0
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
            </div>
          </PopoverAnchor>
          <SlashCommandMenu
            context={slashContext}
            suggestions={suggestions}
            activeIndex={activeIndex}
            onHover={setActiveIndex}
            onSelect={applySuggestion}
          />
        </Popover>
      </div>

      {episCloudBlocked ? (
        <div className="px-3 pb-2">
          <EpisCloudBlockedNotice onActivateClick={onActivateClick ?? (() => {})} />
        </div>
      ) : displayedError ? (
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

// The top-level slash commands. Kept as data so the root menu, filtering, and
// autocomplete all read from one source — adding a command is a one-line edit.
type SlashCommand = {
  name: string;
  command: string;
  description: string;
};

const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "Modify page",
    command: GENERATE_PAGE_COMMAND,
    description: "Regenerate or refine a storefront page",
  },
  {
    name: "Redesign",
    command: REDESIGN_COMMAND,
    description: "Restyle the whole storefront — palette, type, tokens",
  },
];

// A single completion offered to the user. `insert` is the full composer value
// applied on accept; `key` is stable for React; the rest drives rendering.
type Suggestion = {
  key: string;
  insert: string;
  label: string;
  description: string;
  kind: "command" | "page" | "custom";
  designed?: boolean;
};

// What the current input means for the slash UI. `null` means the input is not
// a slash command at all (menu stays closed).
type SlashContext =
  | { mode: "command"; query: string }
  | { mode: "modify-page"; query: string }
  | null;

// Matches "/modify-page", optionally followed by a partial slug, but ONLY while
// the user hasn't started the free-text description yet (no trailing space past
// the slug). Once a description begins we stop suggesting pages.
const MODIFY_PAGE_CONTEXT_RE = new RegExp(
  `^${GENERATE_PAGE_COMMAND.replace(/[/]/g, "\\/")}(?:\\s+(\\S*))?$`,
);

// Derive the slash context from the raw composer value. Pure + synchronous so
// it can drive both the menu and the inline ghost text off one useMemo.
function parseSlashContext(value: string): SlashContext {
  if (!value.startsWith("/")) return null;

  // Still typing the command name itself: "/", "/mod", "/modify-page" (no space).
  if (!value.includes(" ")) {
    return { mode: "command", query: value.slice(1).toLowerCase() };
  }

  // Past the command name — only the modify-page slug stage offers suggestions.
  const match = value.match(MODIFY_PAGE_CONTEXT_RE);
  if (match) {
    return { mode: "modify-page", query: (match[1] ?? "").toLowerCase() };
  }
  return null;
}

// Turn a context into the ordered suggestion list. Matching is a simple
// case-insensitive substring on slug + label so "prod" surfaces Products and
// Product detail. Designed (already-generated) pages sort ahead of skeletons.
function buildSuggestions(
  context: SlashContext,
  generatedSet: Set<string>,
): Suggestion[] {
  if (!context) return [];

  if (context.mode === "command") {
    return SLASH_COMMANDS.filter(
      (cmd) =>
        cmd.command.slice(1).toLowerCase().includes(context.query) ||
        cmd.name.toLowerCase().includes(context.query),
    ).map((cmd) => ({
      key: cmd.command,
      insert: `${cmd.command} `,
      label: cmd.name,
      description: cmd.description,
      kind: "command" as const,
    }));
  }

  const pages = KNOWN_PAGES.filter(
    (page) =>
      // Checkout is a locked, persistent skeleton — it cannot be modified (the
      // dispatcher rejects `/modify-page checkout`), so keep it out of the picker.
      page.slug !== "checkout" &&
      (page.slug.toLowerCase().includes(context.query) ||
        page.label.toLowerCase().includes(context.query)),
  )
    .map((page) => ({
      key: page.slug,
      insert: `${GENERATE_PAGE_COMMAND} ${page.slug} `,
      label: page.label,
      description: PAGE_DESCRIPTIONS[page.slug] ?? page.route,
      kind: "page" as const,
      designed: generatedSet.has(page.slug),
    }))
    // Designed pages first, then alphabetical by original KNOWN_PAGES order.
    .sort((a, b) => Number(b.designed) - Number(a.designed));

  const custom: Suggestion = {
    key: "__custom__",
    insert: `${GENERATE_PAGE_COMMAND} `,
    label: "Custom page",
    description: "Describe a page that isn't in the list",
    kind: "custom",
  };

  return [...pages, custom];
}

function SlashCommandMenu({
  context,
  suggestions,
  activeIndex,
  onHover,
  onSelect,
}: {
  context: SlashContext;
  suggestions: Suggestion[];
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (suggestion: Suggestion) => void;
}) {
  if (!context || suggestions.length === 0) return null;

  const heading =
    context.mode === "command" ? "Commands" : "Modify page — pick a page";

  return (
    <PopoverContent
      align="start"
      side="top"
      sideOffset={8}
      className="w-[min(22rem,calc(100vw-2rem))] p-0"
      // Keep focus in the textarea so typing keeps filtering — the menu is
      // keyboard-driven from the input, not focus-trapped.
      onOpenAutoFocus={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => event.preventDefault()}
    >
      <div className="rounded-card bg-surface" role="listbox" aria-label={heading}>
        <div className="p-2">
          <p className="px-3 py-2 text-caption font-medium text-muted">{heading}</p>
          {suggestions.map((suggestion, index) => {
            const active = index === activeIndex;
            return (
              <button
                key={suggestion.key}
                type="button"
                role="option"
                aria-selected={active}
                onMouseMove={() => onHover(index)}
                // Use onMouseDown (not onClick) so the selection commits before
                // the textarea's blur would otherwise close the popover.
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(suggestion);
                }}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left outline-none
                            ${active ? "bg-chalk text-ink" : "text-ink hover:bg-ink/[0.04]"}`}
              >
                <SuggestionIcon suggestion={suggestion} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-ui-sm font-medium text-ink">
                    {suggestion.label}
                  </span>
                  <span className="truncate text-eyebrow text-muted">
                    {suggestion.description}
                  </span>
                </span>
                <SuggestionTrailing suggestion={suggestion} />
              </button>
            );
          })}
        </div>
        {/* Persistent hint footer explaining the keyboard affordances. */}
        <div className="flex items-center gap-3 border-t border-hairline/70 px-2.5 py-1.5 text-eyebrow text-subtle">
          <span className="inline-flex items-center gap-1">
            <kbd className="composer-kbd">Tab</kbd> complete
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="composer-kbd">↑↓</kbd> navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="composer-kbd">Esc</kbd> dismiss
          </span>
        </div>
      </div>
    </PopoverContent>
  );
}

function SuggestionIcon({ suggestion }: { suggestion: Suggestion }) {
  if (suggestion.kind === "command") {
    return <PencilRuler aria-hidden="true" size={16} className="shrink-0 text-ink" />;
  }
  if (suggestion.kind === "custom") {
    return <FilePlus2 aria-hidden="true" size={16} className="shrink-0 text-muted" />;
  }
  return suggestion.designed ? (
    <CircleCheck aria-hidden="true" size={16} className="shrink-0 text-ink" />
  ) : (
    <Circle aria-hidden="true" size={16} className="shrink-0 text-subtle" />
  );
}

function SuggestionTrailing({ suggestion }: { suggestion: Suggestion }) {
  if (suggestion.kind === "command") {
    return <ChevronRight aria-hidden="true" size={14} className="shrink-0 text-subtle" />;
  }
  if (suggestion.kind === "page") {
    return (
      <span className="shrink-0 text-eyebrow text-subtle">
        {suggestion.designed ? "Designed" : "Skeleton"}
      </span>
    );
  }
  return null;
}
