import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Square,
} from "lucide-react";
import { dumprify } from "@/lib/dumprify";
import type { Message } from "@/shared/project-types";

type MessageBubbleProps = {
  message: Message;
  onRetry?: (messageId: string) => void;
};

function AgentMessageContent({ content }: { content: string }) {
  return (
    <div
      className="min-w-0 max-w-full break-words text-[12px] leading-4 text-current [overflow-wrap:anywhere] [&_code]:rounded-sm [&_code]:bg-black/10 [&_code]:px-xxs [&_code]:py-[1px] [&_code]:text-[11px] [&_h1]:my-xxs [&_h1]:text-[13px] [&_h1]:font-semibold [&_h2]:my-xxs [&_h2]:text-[12px] [&_h2]:font-semibold [&_h3]:my-xxs [&_h3]:text-[12px] [&_h3]:font-semibold [&_li]:my-xxs [&_p]:my-xxs [&_pre]:my-xs [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:whitespace-pre [&_pre]:rounded-md [&_pre]:bg-black/10 [&_pre]:p-xs [&_ul]:my-xs [&_ul]:pl-md"
      dangerouslySetInnerHTML={{ __html: dumprify(content) }}
    />
  );
}

function getAgentDisplayContent(
  content: string,
  status: Message["processingStatus"],
) {
  const fallback =
    status === "failed"
      ? "Could not complete the request. Please try again or adjust your prompt."
      : status === "stopped"
        ? "Processing stopped. You can continue with a new prompt."
        : "### Status\n- Preparing to process your request...";

  if (!content.trim()) return fallback;

  const userFacingLines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(isUserFacingAgentLine);

  if (userFacingLines.length === 0) return fallback;
  return [...new Set(userFacingLines)].join("\n");
}

function isUserFacingAgentLine(line: string) {
  return (
    /^(Analyzing|Understood:|Task identified|Clarification needed:|Initializing project|Creating page|Updating page|Inspecting project|Done\.|Could not complete|Processing stopped|Đang phân tích|Đã hiểu:|Đã xác định task|Cần làm rõ:|Đang khởi tạo dự án|Đang tạo trang|Đang cập nhật trang|Đang kiểm tra dự án|Hoàn tất\.|Không thể hoàn tất xử lý|Đã dừng xử lý)/.test(
      line,
    ) && !/\b\d+\s+file\b/i.test(line)
  );
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const label = isUser ? "You" : "Agent";
  const isFailed = message.processingStatus === "failed";
  const isPending = message.processingStatus === "pending";
  const isStreaming = message.processingStatus === "streaming";
  const isStopped = message.processingStatus === "stopped";
  const canRetry = isFailed && !message.id.startsWith("client-") && !!onRetry;
  const statusLabel = isPending
    ? "Queued"
    : isStreaming
      ? "Streaming"
      : isStopped
        ? "Stopped"
        : isFailed
          ? "Failed"
          : "Ready";
  const content = isUser
    ? message.content
    : getAgentDisplayContent(message.content, message.processingStatus);

  return (
    <article
      className={`flex min-h-0 ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`builder-truncate-safe min-w-0 max-w-[min(420px,92%)] overflow-hidden rounded-md border px-sm py-xs transition-all duration-200 ${
          isUser
            ? "border-[var(--app-border-strong)] bg-[var(--app-selected-bg)] text-[var(--app-selected-text)]"
            : isFailed
              ? "border-[var(--app-border-strong)] bg-[var(--app-danger-bg)] text-[var(--app-danger-text)]"
              : isStopped
                ? "border-[var(--app-border-strong)] bg-[var(--color-block-cream)] text-[var(--app-text)]"
                : "border-[var(--app-border)] bg-[var(--app-panel-bg)] text-[var(--app-panel-text)]"
        } ${isPending ? "opacity-70" : "opacity-100"} ${isStreaming ? "shadow-[0_0_0_1px_var(--app-border-strong)]" : ""}`}
      >
        <div className="mb-xs flex items-center justify-between gap-sm text-[11px] uppercase tracking-[0.08em] text-current opacity-[0.62] [&_svg]:text-current">
          <span className="inline-flex items-center gap-xxs">
            {isUser ? (
              <Clock3 aria-hidden="true" size={12} />
            ) : isFailed ? (
              <AlertCircle aria-hidden="true" size={12} />
            ) : isStreaming ? (
              <Loader2
                aria-hidden="true"
                size={12}
                className="animate-spin text-[var(--app-icon-selected)]"
              />
            ) : isPending ? (
              <Clock3 aria-hidden="true" size={12} />
            ) : isStopped ? (
              <Square aria-hidden="true" size={11} />
            ) : (
              <CheckCircle2 aria-hidden="true" size={12} />
            )}
            {label}
          </span>
          <span className="flex items-center gap-xxs">
            {isPending ? (
              <RefreshCw
                aria-hidden="true"
                size={12}
                className="animate-spin"
              />
            ) : null}
            {statusLabel}
          </span>
        </div>
        {isUser ? (
          <p className="m-0 whitespace-pre-wrap break-words text-[12px] leading-4 [overflow-wrap:anywhere]">
            {content}
          </p>
        ) : (
          <AgentMessageContent content={content} />
        )}

        {canRetry ? (
          <div className="mt-sm flex justify-end">
            <button
              type="button"
              onClick={() => onRetry(message.id)}
              className="inline-flex items-center gap-xxs rounded-pill border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-sm py-xxs text-[11px] font-[520] text-current outline-none transition-colors hover:border-[var(--app-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
            >
              <RefreshCw aria-hidden="true" size={12} />
              Retry
            </button>
          </div>
        ) : null}

        {!isUser && !isFailed && !isPending && !isStreaming && isStopped ? (
          <div className="mt-sm rounded-md border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-xs text-[12px] leading-4 text-[var(--app-muted-text)]">
            Processing stopped. You can continue with a new prompt.
          </div>
        ) : null}
      </div>
    </article>
  );
}
