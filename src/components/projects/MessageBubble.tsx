import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  HelpCircle,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { dumprify } from "@/lib/dumprify";
import type { AgentMessageKind, DesignVariant, Message } from "@/shared/project-types";
import { PlanMessageContent } from "./PlanMessageContent";
import { AgentQuestionBubble } from "./AgentQuestionBubble";
import { ClarificationBubble } from "./ClarificationBubble";
import { PlanReview } from "@/features/agents/ui/PlanReview";
import { DesignVariantPicker } from "@/features/agents/ui/DesignVariantPicker";
import { SkillClarificationList } from "@/features/agents/ui/SkillClarificationList";

type MessageBubbleProps = {
  message: Message;
  onRetry?: (message: Message) => void;
  onSelectOption?: (messageId: string, optionId: string) => Promise<boolean | void>;
  onPlanAction?: (message: Message, action: "approve" | "reject") => Promise<void>;
  planAwaitingReview?: boolean;
  onSubmitFreeText?: (message: Message, freeText: string) => Promise<boolean | void>;
};

const MARKDOWN_CLASS =
  "min-w-0 max-w-full break-words text-[12px] leading-4 text-current [overflow-wrap:anywhere] [&_code]:rounded-sm [&_code]:bg-black/10 [&_code]:px-xxs [&_code]:py-[1px] [&_code]:text-[11px] [&_h1]:my-xxs [&_h1]:text-[13px] [&_h1]:font-semibold [&_h2]:my-xxs [&_h2]:text-[12px] [&_h2]:font-semibold [&_h3]:my-xxs [&_h3]:text-[12px] [&_h3]:font-semibold [&_li]:my-xxs [&_p]:my-xxs [&_pre]:my-xs [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:whitespace-pre [&_pre]:rounded-md [&_pre]:bg-black/10 [&_pre]:p-xs [&_ul]:my-xs [&_ul]:pl-md";

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className={MARKDOWN_CLASS} dangerouslySetInnerHTML={{ __html: dumprify(content) }} />
  );
}

type KindMeta = {
  badge: string;
  icon: typeof HelpCircle;
  tone: string;
};

const KIND_META: Partial<Record<AgentMessageKind, KindMeta>> = {
  clarification: {
    badge: "Needs your input",
    icon: HelpCircle,
    tone: "border-[var(--app-border-strong)] bg-[var(--app-control)] text-[var(--app-panel-text)]",
  },
  error: {
    badge: "Something went wrong",
    icon: AlertCircle,
    tone: "border-[var(--app-border-strong)] bg-[var(--app-danger-bg)] text-[var(--app-danger-text)]",
  },
  review_required: {
    badge: "Needs your review",
    icon: ShieldAlert,
    tone: "border-[var(--app-border-strong)] bg-[var(--color-block-cream)] text-[var(--app-text)]",
  },
};

function AgentBody({
  message,
  onSelectOption,
  onPlanAction,
  planAwaitingReview,
  onSubmitFreeText,
}: {
  message: Message;
  onSelectOption?: (messageId: string, optionId: string) => Promise<boolean | void>;
  onPlanAction?: (message: Message, action: "approve" | "reject") => Promise<void>;
  planAwaitingReview?: boolean;
  onSubmitFreeText?: (message: Message, freeText: string) => Promise<boolean | void>;
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
    const questionType = (message.metadata as { questionType?: string } | null)?.questionType;
    if (questionType === "design_variant" && onSelectOption) {
      const variants = (message.metadata?.options as DesignVariant[] | undefined) ?? [];
      const selected = (message.metadata as { selectedOptionId?: string | null } | null)
        ?.selectedOptionId;
      if (selected) {
        // already chosen — keep render minimal; existing bubble shows confirmation.
        return <AgentQuestionBubble message={message} onSelectOption={onSelectOption} />;
      }
      return (
        <DesignVariantPicker
          variants={variants}
          onSelect={async (optionId) => {
            console.log("[bubble] DesignVariantPicker onSelect", { messageId: message.id, optionId });
            const ok = await onSelectOption(message.id, optionId);
            console.log("[bubble] DesignVariantPicker onSelect → result", { ok });
            if (ok === false) {
              throw new Error("submit_failed");
            }
          }}
          onCustom={
            onSubmitFreeText
              ? async (freeText) => {
                  console.log("[bubble] DesignVariantPicker onCustom", { messageId: message.id });
                  const ok = await onSubmitFreeText(message, freeText);
                  console.log("[bubble] DesignVariantPicker onCustom → result", { ok });
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
      const options = ((message.metadata as { options?: { id: string; label: string }[] } | null)
        ?.options ?? []) as { id: string; label: string }[];
      const selected = (message.metadata as { selectedOptionId?: string | null } | null)
        ?.selectedOptionId;
      if (selected) {
        return <AgentQuestionBubble message={message} onSelectOption={onSelectOption} />;
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
    return <AgentQuestionBubble message={message} onSelectOption={onSelectOption} />;
  }
  if (message.kind === "clarification") return <ClarificationBubble message={message} onSelectOption={onSelectOption} />;
  return <MarkdownContent content={message.content} />;
}

export function MessageBubble({
  message,
  onRetry,
  onSelectOption,
  onPlanAction,
  planAwaitingReview,
  onSubmitFreeText,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <article className="flex min-h-0 justify-end">
        <div className="builder-truncate-safe min-w-0 max-w-[min(420px,92%)] overflow-hidden rounded-md border border-[var(--app-border-strong)] bg-[var(--app-selected-bg)] px-sm py-xs text-[var(--app-selected-text)]">
          <div className="mb-xs flex items-center gap-xxs text-[11px] uppercase tracking-[0.08em] opacity-[0.62]">
            <Clock3 aria-hidden="true" size={12} />
            You
          </div>
          <p className="m-0 whitespace-pre-wrap break-words text-[12px] leading-4 [overflow-wrap:anywhere]">
            {message.content}
          </p>
        </div>
      </article>
    );
  }

  const meta = message.kind ? KIND_META[message.kind] : undefined;
  const isStreaming = message.processingStatus === "streaming";
  const isFailed = message.processingStatus === "failed";
  // An answer that failed mid-stream keeps its partial text — show it as
  // "interrupted" (softer than a hard error, since the agent did produce work).
  const isInterruptedAnswer = message.kind === "answer" && isFailed;
  // Any failed agent message can be retried (error milestone or interrupted answer).
  const canRetry = (message.kind === "error" || isFailed) && !!onRetry;

  const interruptedMeta: KindMeta = {
    badge: "Bị gián đoạn",
    icon: AlertTriangle,
    tone: "border-[var(--app-border-strong)] bg-[var(--color-block-cream)] text-[var(--app-text)]",
  };
  const activeMeta = isInterruptedAnswer ? interruptedMeta : meta;

  const tone =
    activeMeta?.tone ??
    "border-[var(--app-border)] bg-[var(--app-panel-bg)] text-[var(--app-panel-text)]";
  const HeaderIcon = activeMeta?.icon ?? (isStreaming ? Loader2 : CheckCircle2);
  const headerLabel = activeMeta?.badge ?? "Agent";

  return (
    <article className="flex min-h-0 justify-start">
      <div
        className={`builder-truncate-safe min-w-0 max-w-[min(420px,92%)] overflow-hidden rounded-md border px-sm py-xs transition-all duration-200 ${tone} ${
          isStreaming ? "shadow-[0_0_0_1px_var(--app-border-strong)]" : ""
        }`}
      >
        <div className="mb-xs flex items-center gap-xxs text-[11px] uppercase tracking-[0.08em] opacity-[0.62] [&_svg]:text-current">
          <HeaderIcon
            aria-hidden="true"
            size={12}
            className={isStreaming && !activeMeta ? "animate-spin text-[var(--app-icon-selected)]" : ""}
          />
          {headerLabel}
        </div>

        <AgentBody
          message={message}
          onSelectOption={onSelectOption}
          onPlanAction={onPlanAction}
          planAwaitingReview={planAwaitingReview}
          onSubmitFreeText={onSubmitFreeText}
        />

        {canRetry ? (
          <div className="mt-sm flex justify-end">
            <button
              type="button"
              onClick={() => onRetry?.(message)}
              className="inline-flex items-center gap-xxs rounded-pill border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-sm py-xxs text-[11px] font-[520] text-current outline-none transition-colors hover:border-[var(--app-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
            >
              <RefreshCw aria-hidden="true" size={12} />
              Retry
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
