import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Eye,
  FilePen,
  FilePlus,
  FileStack,
  Globe,
  HelpCircle,
  KeyRound,
  Lightbulb,
  ListTree,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  Terminal,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { dumprify } from "@/lib/dumprify";
import type {
  AgentMessageKind,
  DesignVariant,
  Message,
} from "@/shared/project-types";
import { PlanMessageContent } from "./PlanMessageContent";
import { AgentQuestionBubble } from "./AgentQuestionBubble";
import { ClarificationBubble } from "./ClarificationBubble";
import { PlanReview } from "@/features/agents/ui/PlanReview";
import { DesignVariantPicker } from "@/features/agents/ui/DesignVariantPicker";
import { SkillClarificationList } from "@/features/agents/ui/SkillClarificationList";

type MessageBubbleProps = {
  message: Message;
  runActive?: boolean;
  onRetry?: (message: Message) => void;
  onSelectOption?: (
    messageId: string,
    optionId: string,
  ) => Promise<boolean | void>;
  onPlanAction?: (
    message: Message,
    action: "approve" | "reject",
  ) => Promise<void>;
  planAwaitingReview?: boolean;
  onSubmitFreeText?: (
    message: Message,
    freeText: string,
  ) => Promise<boolean | void>;
  runnerMessages?: Message[];
  // Runner-card footer wiring. The inner steps live in the right-hand detail
  // panel (RunnerDetailPanel), not inline, so the card only needs to know
  // whether its own detail view is the one currently showing and how to
  // toggle it / return to preview.
  runnerDetailActive?: boolean;
  onToggleRunnerDetails?: (runId: string) => void;
  onPreviewRunner?: () => void;
};

const MARKDOWN_CLASS =
  "msg-prose [&_pre]:my-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:whitespace-pre [&_pre]:rounded-md [&_pre]:bg-ink/[0.06] [&_pre]:p-2 [&_pre]:text-[12px] [&_pre]:font-mono [&_h1]:mt-2 [&_h1]:text-[14px] [&_h1]:font-semibold [&_h2]:mt-2 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-[13px] [&_h3]:font-semibold";

function MarkdownContent({ content }: { content: string }) {
  return (
    <div
      className={MARKDOWN_CLASS}
      dangerouslySetInnerHTML={{ __html: dumprify(content) }}
    />
  );
}

type KindMeta = {
  badge: string;
  icon: typeof HelpCircle;
};

const KIND_META: Partial<Record<AgentMessageKind, KindMeta>> = {
  clarification: { badge: "Needs your decision", icon: HelpCircle },
  error: { badge: "Error occurred", icon: AlertCircle },
  review_required: { badge: "Needs your review", icon: ShieldAlert },
};

export function AgentBody({
  message,
  onSelectOption,
  onPlanAction,
  planAwaitingReview,
  onSubmitFreeText,
}: {
  message: Message;
  onSelectOption?: (
    messageId: string,
    optionId: string,
  ) => Promise<boolean | void>;
  onPlanAction?: (
    message: Message,
    action: "approve" | "reject",
  ) => Promise<void>;
  planAwaitingReview?: boolean;
  onSubmitFreeText?: (
    message: Message,
    freeText: string,
  ) => Promise<boolean | void>;
}) {
  if (message.kind === "plan") {
    if (planAwaitingReview && onPlanAction) {
      return (
        <PlanReview
          planMarkdown={message.content}
          onApprove={() => onPlanAction(message, "approve")}
          onReject={() => onPlanAction(message, "reject")}
        />
      );
    }
    return <PlanMessageContent content={message.content} />;
  }
  if (message.kind === "agent_question") {
    const questionType = (message.metadata as { questionType?: string } | null)
      ?.questionType;
    if (questionType === "design_variant" && onSelectOption) {
      const variants =
        (message.metadata?.options as DesignVariant[] | undefined) ?? [];
      const selected = (
        message.metadata as { selectedOptionId?: string | null } | null
      )?.selectedOptionId;
      if (selected) {
        const picked = variants.find((v) => v.id === selected);
        return (
          <CommittedAnswerInline
            question={message.content}
            answer={picked?.label ?? selected}
          />
        );
      }
      return (
        <DesignVariantPicker
          question={message.content}
          variants={variants}
          onSelect={async (optionId) => {
            const ok = await onSelectOption(message.id, optionId);
            if (ok === false) {
              throw new Error("submit_failed");
            }
          }}
          onCustom={
            onSubmitFreeText
              ? async (freeText) => {
                  const ok = await onSubmitFreeText(message, freeText);
                  if (ok === false) {
                    throw new Error("submit_failed");
                  }
                }
              : undefined
          }
        />
      );
    }
    if (questionType === "skill_clarification" && onSelectOption) {
      const options = ((
        message.metadata as { options?: { id: string; label: string }[] } | null
      )?.options ?? []) as { id: string; label: string }[];
      const selected = (
        message.metadata as { selectedOptionId?: string | null } | null
      )?.selectedOptionId;
      if (selected) {
        const picked = options.find((o) => o.id === selected);
        return (
          <CommittedAnswerInline
            question={message.content}
            answer={picked?.label ?? selected}
          />
        );
      }
      return (
        <SkillClarificationList
          question={message.content}
          options={options}
          onSelect={async (optionId) => {
            const ok = await onSelectOption(message.id, optionId);
            if (ok === false) {
              throw new Error("submit_failed");
            }
          }}
        />
      );
    }
    return (
      <AgentQuestionBubble message={message} onSelectOption={onSelectOption} />
    );
  }
  if (message.kind === "clarification")
    return (
      <ClarificationBubble message={message} onSelectOption={onSelectOption} />
    );
  return <MarkdownContent content={message.content} />;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

export function MessageBubble({
  message,
  runActive,
  onRetry,
  onSelectOption,
  onPlanAction,
  planAwaitingReview,
  onSubmitFreeText,
  runnerDetailActive,
  onToggleRunnerDetails,
  onPreviewRunner,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const time = formatTime(message.createdAt);

  if (message.kind === "runner") {
    return (
      <RunnerCard
        message={message}
        runActive={runActive}
        detailActive={!!runnerDetailActive}
        onToggleDetails={onToggleRunnerDetails}
        onPreview={onPreviewRunner}
      />
    );
  }

  if (isUser) {
    return (
      <article className="flex justify-end">
        <div className="msg-bubble-user">
          <div className="msg-meta justify-end">
            {time ? <span className="msg-time">{time}</span> : null}
          </div>
          <div className="msg-prose">
            <p className="m-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {message.content}
            </p>
          </div>
        </div>
      </article>
    );
  }

  const meta = message.kind ? KIND_META[message.kind] : undefined;
  const isStreaming = message.processingStatus === "streaming";
  const isFailed = message.processingStatus === "failed";
  const isInterruptedAnswer = message.kind === "answer" && isFailed;
  const canRetry = (message.kind === "error" || isFailed) && !!onRetry;

  const interruptedMeta: KindMeta = {
    badge: "Interrupted",
    icon: AlertTriangle,
  };
  const activeMeta = isInterruptedAnswer ? interruptedMeta : meta;
  const StatusIcon = isStreaming ? Loader2 : CheckCircle2;
  const messageMetadata = message.metadata as unknown as {
    model?: unknown;
  } | null;
  const modelLabel =
    typeof messageMetadata?.model === "string" ? messageMetadata.model : null;

  return (
    <article className="msg-row mt-4">
      <div className="msg-content">
        <div className="msg-meta flex-wrap">
          {time ? <span className="msg-time">{time}</span> : null}
          {modelLabel ? <span className="msg-model">{modelLabel}</span> : null}
          {isStreaming ? (
            <span className="msg-pill">
              <Loader2 aria-hidden="true" size={10} className="animate-spin" />
              Replying
            </span>
          ) : null}
          {activeMeta ? (
            <span className="msg-pill-warn">
              <activeMeta.icon aria-hidden="true" size={10} />
              {activeMeta.badge}
            </span>
          ) : !isStreaming && message.kind === "answer" ? (
            <StatusIcon
              aria-hidden="true"
              size={12}
              className="text-success-fg"
            />
          ) : null}
        </div>

        <AgentBody
          message={message}
          onSelectOption={onSelectOption}
          onPlanAction={onPlanAction}
          planAwaitingReview={planAwaitingReview}
          onSubmitFreeText={onSubmitFreeText}
        />

        {canRetry ? (
          <div className="mt-2 flex">
            <Button
              variant="unstyled"
              type="button"
              onClick={() => onRetry?.(message)}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-eyebrow font-medium text-muted hover:bg-ink/[0.04] hover:text-ink focus-ring"
            >
              <RefreshCw aria-hidden="true" size={12} />
              Retry
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function RunnerCard({
  message,
  runActive,
  detailActive,
  onToggleDetails,
  onPreview,
}: {
  message: Message;
  runActive?: boolean;
  // True when THIS runner's detail view is the one showing in the right panel.
  detailActive?: boolean;
  onToggleDetails?: (runId: string) => void;
  onPreview?: () => void;
}) {
  const time = formatTime(message.createdAt);
  const isStreaming = message.processingStatus === "streaming" || runActive;
  const isFailed = message.processingStatus === "failed";
  const summary =
    message.content ||
    (isStreaming ? "Working…" : isFailed ? "Run failed" : "Done");
  const runId = message.runId;

  return (
    <article className="msg-row mt-4">
      <div className="msg-content">
        <div className="msg-meta flex-wrap">
          {time ? <span className="msg-time">{time}</span> : null}
        </div>

        <div className="rounded-md border border-hairline bg-ink/[0.02]">
          <div className="flex w-full items-center gap-2 px-3 py-2">
            {isStreaming ? (
              <Loader2
                aria-hidden="true"
                size={13}
                className="shrink-0 animate-spin text-muted"
              />
            ) : isFailed ? (
              <AlertTriangle
                aria-hidden="true"
                size={13}
                className="shrink-0 text-warn-fg"
              />
            ) : (
              <CheckCircle2
                aria-hidden="true"
                size={13}
                className="shrink-0 text-success-fg"
              />
            )}
            <span className="flex-1 truncate text-[12.5px] font-medium text-ink">
              {summary}
            </span>
          </div>

          {/* Footer: Details toggles the right-hand detail panel for THIS run;
              Preview returns to the preview panel and is only enabled while
              this run's detail view is showing. */}
          <div className="flex items-center gap-1 border-t border-hairline px-2 py-1.5">
            <Button
              variant="unstyled"
              type="button"
              disabled={!runId || !onToggleDetails}
              onClick={() => runId && onToggleDetails?.(runId)}
              aria-pressed={detailActive}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-eyebrow font-medium text-muted hover:bg-ink/[0.04] hover:text-ink focus-ring disabled:opacity-40 disabled:cursor-default cursor-pointer"
            >
              <ListTree aria-hidden="true" size={12} />
              {detailActive ? "Hide details" : "Details"}
            </Button>
            <Button
              variant="unstyled"
              type="button"
              disabled={!detailActive || !onPreview}
              onClick={() => onPreview?.()}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-eyebrow font-medium text-muted hover:bg-ink/[0.04] hover:text-ink focus-ring disabled:opacity-40 disabled:cursor-default cursor-pointer"
            >
              <Eye aria-hidden="true" size={12} />
              Preview
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

type LucideIcon = typeof HelpCircle;

// Each runner step has a semantic *type* (thinking / edit / command / fetch /
// …). The type fixes a verb whose tense follows the step's processing status:
// present-continuous while the step is running ("Editing"), simple past once it
// finishes ("Edited"). `present`/`past` are the English verb forms; the icon is
// a default that a keyword scan can override for the more distinctive targets
// (key, domain, cart).
type StepTypeKey =
  | "thinking"
  | "answer"
  | "edit"
  | "create"
  | "read"
  | "list"
  | "search"
  | "command"
  | "fetch"
  | "install"
  | "config"
  | "count"
  | "generic";

type StepTypeDef = {
  icon: LucideIcon;
  present: string;
  past: string;
  // Lowercased leading-verb spellings (any tense) that identify this type.
  verbs: string[];
};

const STEP_TYPES: Record<StepTypeKey, StepTypeDef> = {
  thinking: {
    icon: Lightbulb,
    present: "Thinking",
    past: "Thought",
    verbs: ["thinking", "thought", "think", "reasoning", "reasoned", "reason"],
  },
  answer: {
    icon: Sparkles,
    present: "Responding",
    past: "Responded",
    verbs: [
      "responding",
      "responded",
      "respond",
      "answering",
      "answered",
      "answer",
    ],
  },
  edit: {
    icon: FilePen,
    present: "Editing",
    past: "Edited",
    verbs: [
      "editing",
      "edited",
      "edit",
      "updating",
      "updated",
      "update",
      "modifying",
      "modified",
      "modify",
      "writing",
      "wrote",
      "written",
      "write",
    ],
  },
  create: {
    icon: FilePlus,
    present: "Creating",
    past: "Created",
    verbs: [
      "creating",
      "created",
      "create",
      "adding",
      "added",
      "add",
      "generating",
      "generated",
      "generate",
    ],
  },
  read: {
    icon: FileStack,
    present: "Reading",
    past: "Read",
    verbs: [
      "reading",
      "read",
      "opening",
      "opened",
      "open",
      "viewing",
      "viewed",
      "inspecting",
      "inspected",
    ],
  },
  list: {
    icon: ListTree,
    present: "Listing",
    past: "Listed",
    verbs: ["listing", "listed", "list"],
  },
  search: {
    icon: Search,
    present: "Searching",
    past: "Searched",
    verbs: [
      "searching",
      "searched",
      "search",
      "scanning",
      "scanned",
      "scan",
      "finding",
      "found",
      "glob",
      "grepping",
      "grepped",
      "grep",
    ],
  },
  command: {
    icon: Terminal,
    present: "Running",
    past: "Ran",
    verbs: [
      "running",
      "ran",
      "run",
      "runned",
      "executing",
      "executed",
      "execute",
      "building",
      "built",
      "build",
    ],
  },
  fetch: {
    icon: Globe,
    present: "Fetching",
    past: "Fetched",
    verbs: [
      "fetching",
      "fetched",
      "fetch",
      "loading",
      "loaded",
      "load",
      "retrieving",
      "retrieved",
      "retrieve",
      "requesting",
      "requested",
      "request",
    ],
  },
  install: {
    icon: Package,
    present: "Installing",
    past: "Installed",
    verbs: ["installing", "installed", "install"],
  },
  config: {
    icon: Settings2,
    present: "Configuring",
    past: "Configured",
    verbs: ["configuring", "configured", "configure", "setting", "setup"],
  },
  count: {
    icon: ShoppingCart,
    present: "Counting",
    past: "Counted",
    verbs: ["counting", "counted", "count"],
  },
  generic: {
    icon: Wrench,
    present: "Working",
    past: "Done",
    verbs: [],
  },
};

const FILE_TOKEN =
  /([\w./-]+\.(?:tsx?|jsx?|mjs|cjs|css|scss|json|md|html|svg|toml|ya?ml))/;

// Picks the node icon from the step's target keywords, so a token/domain/cart
// step gets its distinctive glyph even when its leading verb ("Fetched") maps
// to a generic type. Falls back to the verb type's own icon.
function pickIcon(
  lower: string,
  token: string | undefined,
  fallback: LucideIcon,
): LucideIcon {
  if (/token|api key|\bkey\b|auth|secret|credential/.test(lower))
    return KeyRound;
  if (/domain|hostname|\burl\b|http|endpoint/.test(lower)) return Globe;
  if (/product|\bcart\b|order|checkout|storefront|\bshop\b/.test(lower))
    return ShoppingCart;
  if (/instal|\bpackage\b|dependenc|\bnpm\b|\bpnpm\b|\byarn\b/.test(lower))
    return Package;
  if (/config|setting|zustand|\bstore\b/.test(lower)) return Settings2;
  if (token)
    return /edit|updat|modif|wrote|writ|creat/.test(lower)
      ? FilePen
      : FileStack;
  return fallback;
}

// Maps a step to a timeline row: a type-derived node icon, a tensed verb label
// (present while running, past once completed), and an optional monospace chip
// carrying the file the step touched. Reasoning/answer steps are typed straight
// from their kind; action steps are classified from their free text.
function deriveStepView(
  step: Message,
  active: boolean,
): { icon: LucideIcon; label: string; chip?: string } {
  const isReasoning = step.kind === "reasoning" || step.kind === "thinking";
  const isAnswer = step.kind === "answer";
  if (isReasoning || isAnswer) {
    const def = isReasoning ? STEP_TYPES.thinking : STEP_TYPES.answer;
    return { icon: def.icon, label: active ? def.present : def.past };
  }

  const firstLine = (
    step.content.trim().split("\n")[0] ?? step.content.trim()
  ).trim();
  const lower = firstLine.toLowerCase();
  const tokenMatch = firstLine.match(FILE_TOKEN);
  const token = tokenMatch?.[1];
  const chip = token ? (token.split("/").pop() ?? token) : undefined;

  // Classify by the leading verb first (so we can retense it), then fall back
  // to a keyword scan of the whole line.
  const words = firstLine.split(/\s+/);
  const firstWord = (words[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
  let typeKey: StepTypeKey = "generic";
  let matchedByVerb = false;
  for (const key of Object.keys(STEP_TYPES) as StepTypeKey[]) {
    if (STEP_TYPES[key].verbs.includes(firstWord)) {
      typeKey = key;
      matchedByVerb = true;
      break;
    }
  }
  if (!matchedByVerb) {
    if (/\b(edit|updat|modif|wrote|writ)/.test(lower)) typeKey = "edit";
    else if (/\bcreat|\badd(ed|ing)?\b/.test(lower)) typeKey = "create";
    else if (/\blist/.test(lower)) typeKey = "list";
    else if (/\b(read|scan|search|glob|grep|find)/.test(lower))
      typeKey = "search";
    else if (/\b(run|command|execut|build)/.test(lower)) typeKey = "command";
    else if (/instal/.test(lower)) typeKey = "install";
    else if (/config|setting|set up|setup|zustand|\bstore\b/.test(lower))
      typeKey = "config";
    else if (/\bcount/.test(lower)) typeKey = "count";
    else if (
      /token|api key|\bkey\b|auth|secret|credential|domain|hostname|\burl\b|http|endpoint|fetch|load|retriev/.test(
        lower,
      )
    )
      typeKey = "fetch";
    else if (/product|\bcart\b|order|checkout|storefront|\bshop\b/.test(lower))
      typeKey = "count";
  }

  const def = STEP_TYPES[typeKey];
  const verb = active ? def.present : def.past;
  const icon = pickIcon(lower, token, def.icon);

  // The title is always a clean action verb. When we recognized an English
  // leading verb we drop it and keep the remaining object ("Fetched storefront
  // token" → "Fetched" + "storefront token"). Otherwise — a keyword-only match
  // or unclassified free text (e.g. Vietnamese prose) — the tensed verb stands
  // alone as the title and the full text lives in the expandable body.
  let label: string;
  if (matchedByVerb) {
    let rest = words.slice(1).join(" ");
    if (token) rest = rest.replace(token, "").trim();
    rest = rest
      .replace(/^[:\-–—]\s*/, "")
      .replace(/[:\-–—]\s*$/, "")
      .trim();
    label = rest ? `${verb} ${rest}` : verb;
  } else {
    label = verb;
  }

  return { icon, label, chip };
}

// A clarification-family message (agent_question / clarification / plan) as a
// timeline row. Unlike RunnerStep it is never collapsed — the body carries an
// interactive form while the agent is waiting and the committed result once the
// user answers, both of which must stay visible. AgentBody picks the right view
// from the message kind + metadata (pending form vs. CommittedAnswerInline).
export function RunnerClarificationStep({
  step,
  isFirst,
  isLast,
  pending,
  planAwaitingReview,
  onSelectOption,
  onPlanAction,
  onSubmitFreeText,
}: {
  step: Message;
  isFirst?: boolean;
  isLast?: boolean;
  // True while the run is still blocked on THIS message (drives the rail
  // spinner and the "Needs your input" vs "Your answer" label).
  pending?: boolean;
  planAwaitingReview?: boolean;
  onSelectOption?: (
    messageId: string,
    optionId: string,
  ) => Promise<boolean | void>;
  onPlanAction?: (
    message: Message,
    action: "approve" | "reject",
  ) => Promise<void>;
  onSubmitFreeText?: (
    message: Message,
    freeText: string,
  ) => Promise<boolean | void>;
}) {
  return (
    <li className="relative flex list-none gap-2.5">
      <TimelineRail
        isFirst={isFirst}
        isLast={isLast}
        icon={ClipboardList}
        active={pending}
      />

      <div className="min-w-0 flex-1 pb-3.5">
        <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-subtle">
          {pending ? "Needs your input" : "Your answer"}
        </div>
        <AgentBody
          message={step}
          planAwaitingReview={planAwaitingReview}
          onSelectOption={onSelectOption}
          onPlanAction={onPlanAction}
          onSubmitFreeText={onSubmitFreeText}
        />
      </div>
    </li>
  );
}

// One row of the runner activity timeline. Every row is a collapsible: the
// header shows the type + tensed verb, and expanding it reveals the full text
// of what the step did (or is doing). The vertical connector rail is drawn
// per-row so consecutive rows form one continuous line through the icon nodes.
export function RunnerStep({
  step,
  isFirst,
  isLast,
}: {
  step: Message;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const active =
    step.processingStatus === "streaming" ||
    step.processingStatus === "pending";
  const isAnswer = step.kind === "answer";
  const view = deriveStepView(step, active);
  const [open, setOpen] = useState(false);
  const Icon = view.icon;
  const hasBody = step.content.trim().length > 0;

  return (
    <li className="relative flex list-none gap-2.5">
      <TimelineRail
        isFirst={isFirst}
        isLast={isLast}
        icon={Icon}
        active={active}
      />

      <div className="min-w-0 flex-1 pb-3.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          disabled={!hasBody}
          className="group flex w-full items-center gap-1.5 text-left rounded-sm focus-ring transition-colors hover:text-ink disabled:cursor-default cursor-pointer"
        >
          <span
            className="min-w-0 truncate text-[12.5px] leading-5 text-ink"
            title={view.label}
          >
            {view.label}
          </span>
          {view.chip ? (
            <code className="shrink-0 rounded bg-ink/[0.06] px-1.5 py-px font-mono text-[11px] text-muted">
              {view.chip}
            </code>
          ) : null}
          {hasBody ? (
            open ? (
              <ChevronDown
                aria-hidden="true"
                size={13}
                className="ml-auto shrink-0 text-subtle transition-colors group-hover:text-muted"
              />
            ) : (
              <ChevronRight
                aria-hidden="true"
                size={13}
                className="ml-auto shrink-0 text-subtle transition-colors group-hover:text-muted"
              />
            )
          ) : null}
        </button>

        {open && hasBody ? (
          <div className="mt-2">
            {isAnswer ? (
              <MarkdownContent content={step.content} />
            ) : (
              <div className="whitespace-pre-wrap break-words rounded-md border border-hairline bg-ink/[0.02] px-3 py-2 text-[12px] leading-relaxed text-muted">
                {step.content}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </li>
  );
}

// The gutter node: a continuous vertical rail with the step's icon centered on
// it. While the step is running the node shows a spinner instead of its type
// icon. The rail segment above the icon is hidden on the first row and the
// segment below on the last, so the line starts and ends at the outer nodes.
function TimelineRail({
  icon: Icon,
  isFirst,
  isLast,
  active,
}: {
  icon: LucideIcon;
  isFirst?: boolean;
  isLast?: boolean;
  active?: boolean;
}) {
  return (
    <div className="relative flex w-4 shrink-0 justify-center">
      <span
        aria-hidden="true"
        className={`absolute left-1/2 top-0 w-px -translate-x-1/2 bg-hairline ${
          isFirst ? "h-[9px]" : "h-2.5"
        } ${isFirst ? "opacity-0" : ""}`}
      />
      <span
        aria-hidden="true"
        className={`absolute bottom-0 left-1/2 top-[18px] w-px -translate-x-1/2 bg-hairline ${
          isLast ? "opacity-0" : ""
        }`}
      />
      <span
        className={`relative z-10 mt-[3px] flex h-3.5 w-3.5 items-center justify-center bg-paper ${
          active ? "text-ink" : "text-subtle"
        }`}
      >
        {active ? (
          <Loader2
            aria-hidden="true"
            size={13}
            className="animate-spin motion-reduce:animate-none"
          />
        ) : (
          <Icon aria-hidden="true" size={13} />
        )}
      </span>
    </div>
  );
}

function CommittedAnswerInline({
  question,
  answer,
  description,
  onChange,
}: {
  question: string;
  answer: string;
  description?: string;
  onChange?: () => void;
}) {
  return (
    <div
      className="overflow-hidden rounded-lg border border-hairline bg-surface"
      aria-live="polite"
    >
      {question ? (
        <div className="px-3.5 pb-2.5 pt-3">
          <div className="text-[13.5px] font-medium leading-snug text-ink">
            {question}
          </div>
          {description ? (
            <div className="mt-1 text-[12px] leading-relaxed text-muted">
              {description}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-center gap-2 border-t border-hairline bg-success-bg/30 px-3.5 py-2.5">
        <Check
          aria-hidden="true"
          size={14}
          className="shrink-0 text-success-fg"
          strokeWidth={2.5}
        />
        <span className="text-[12px] text-ink">
          Selected: <span className="font-medium">{answer}</span>
        </span>
        {onChange ? (
          <Button
            variant="unstyled"
            type="button"
            onClick={onChange}
            className="ml-auto text-[11.5px] text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Change
          </Button>
        ) : null}
      </div>
    </div>
  );
}
