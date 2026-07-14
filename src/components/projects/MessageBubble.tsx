import {
  AlertCircle,
  AlertTriangle,
  Brain,
  Check,
  CheckCircle2,
  Eye,
  HelpCircle,
  ListTree,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
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
  runActive,
  onSelectOption,
  onPlanAction,
  planAwaitingReview,
  onSubmitFreeText,
}: {
  message: Message;
  runActive?: boolean;
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
  if (message.kind === "thinking" || message.kind === "reasoning") {
    return <ThinkingBubble content={message.content} />;
  }
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
  if (message.kind === "agent_message") {
    return (
      <ProcessingNoteBubble content={message.content} runActive={runActive} />
    );
  }
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
      <article className="flex">
        <div className="msg-bubble-user">
          <div className="msg-meta">
            <span className="msg-author">You</span>
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
      <div className="msg-avatar-agent">
        <Sparkles aria-hidden="true" size={14} />
      </div>

      <div className="msg-content">
        <div className="msg-meta flex-wrap">
          <span className="msg-author">Cloud AI</span>
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
          runActive={runActive}
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
      <div className="msg-avatar-agent">
        <Sparkles aria-hidden="true" size={14} />
      </div>

      <div className="msg-content">
        <div className="msg-meta flex-wrap">
          <span className="msg-author">Cloud AI</span>
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

// Renders a single runner sub-step. Shared by RunnerDetailPanel so the detail
// view uses the same visual language as the inline bubbles.
export function RunnerStep({ step }: { step: Message }) {
  if (step.kind === "reasoning" || step.kind === "thinking") {
    return <ThinkingBubble content={step.content} />;
  }
  if (step.kind === "answer") {
    return <MarkdownContent content={step.content} />;
  }
  return <ProcessingNoteBubble content={step.content} runActive={false} />;
}

function ThinkingBubble({ content }: { content: string }) {
  return (
    <div className="rounded-md border border-dashed border-hairline bg-ink/[0.02] px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-subtle">
        <Brain aria-hidden="true" size={11} />
        Thinking
      </div>
      <div className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-muted">
        {content}
      </div>
    </div>
  );
}

function ProcessingNoteBubble({
  content,
  runActive,
}: {
  content: string;
  runActive?: boolean;
}) {
  return (
    <div className="rounded-md border border-hairline bg-ink/[0.02] px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-subtle">
        {runActive ? (
          <>
            <Loader2 aria-hidden="true" size={11} className="animate-spin" />
            Processing
          </>
        ) : (
          <>
            <Check aria-hidden="true" size={11} />
            Done
          </>
        )}
      </div>
      <div className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-muted">
        {content}
      </div>
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
