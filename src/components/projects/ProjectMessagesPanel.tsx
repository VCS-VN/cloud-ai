import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { EmptyState } from "../common/EmptyState";
import { ErrorState } from "../common/ErrorState";
import { LoadingState } from "../common/LoadingState";
import type { Message, SkeletonState } from "@/shared/project-types";
import { MessageBubble } from "./MessageBubble";
import { SkeletonMessageBubble } from "./SkeletonMessageBubble";

type ProjectMessagesPanelProps = {
  messages: Message[];
  skeleton?: SkeletonState | null;
  loading?: boolean;
  loadingOlder?: boolean;
  hasMore?: boolean;
  error?: string;
  onLoadOlder?: () => void;
  onRetryMessage?: (message: Message) => void;
};

const STICK_TO_BOTTOM_THRESHOLD = 72;
const MIN_MESSAGE_HEIGHT_FALLBACK = 56;
const JUMP_TO_LATEST_MESSAGE_COUNT = 10;

type RenderItem =
  | { type: "single"; message: Message }
  | { type: "run-group"; runId: string; messages: Message[] };

/**
 * Groups consecutive agent messages that share a runId into a single
 * border-left wrapper. User messages always render standalone. Order is
 * preserved by createdAt (already sorted by caller).
 */
export function buildRenderItems(messages: Message[]): RenderItem[] {
  const items: RenderItem[] = [];
  for (const message of messages) {
    if (message.role !== "agent" || !message.runId) {
      items.push({ type: "single", message });
      continue;
    }
    const last = items[items.length - 1];
    if (last && last.type === "run-group" && last.runId === message.runId) {
      last.messages.push(message);
    } else {
      items.push({ type: "run-group", runId: message.runId, messages: [message] });
    }
  }
  return items;
}

export function ProjectMessagesPanel({
  messages,
  skeleton,
  loading = false,
  loadingOlder = false,
  hasMore = false,
  error,
  onLoadOlder,
  onRetryMessage,
}: ProjectMessagesPanelProps) {
  const viewportRef = useRef<HTMLElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const orderedMessages = useMemo(
    () =>
      [...messages].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      ),
    [messages],
  );
  const renderItems = useMemo(() => buildRenderItems(orderedMessages), [orderedMessages]);
  const stickToBottomRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const lastMessage = orderedMessages[orderedMessages.length - 1];
  const lastMessageId = lastMessage?.id;
  const lastMessageSignature = lastMessage
    ? `${lastMessage.id}:${lastMessage.processingStatus}:${lastMessage.content.length}`
    : undefined;
  const previousLastMessageIdRef = useRef<string | undefined>(undefined);

  const syncScrollState = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const isNearBottom = distanceFromBottom < STICK_TO_BOTTOM_THRESHOLD;
    stickToBottomRef.current = isNearBottom;

    const messageElements = messageListRef.current
      ? Array.from(
          messageListRef.current.querySelectorAll<HTMLElement>(
            '[data-message-bubble="true"]',
          ),
        )
      : [];
    const averageMessageHeight =
      messageElements.length > 0
        ? messageElements.reduce(
            (total, element) => total + element.offsetHeight,
            0,
          ) / messageElements.length
        : MIN_MESSAGE_HEIGHT_FALLBACK;
    const jumpThreshold = Math.max(
      MIN_MESSAGE_HEIGHT_FALLBACK * JUMP_TO_LATEST_MESSAGE_COUNT,
      averageMessageHeight * JUMP_TO_LATEST_MESSAGE_COUNT,
    );

    setShowJumpToLatest(distanceFromBottom >= jumpThreshold);
  };

  useEffect(() => {
    syncScrollState();
  }, [orderedMessages.length, lastMessageSignature]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || orderedMessages.length === 0) return;

    const previousLastMessageId = previousLastMessageIdRef.current;
    previousLastMessageIdRef.current = lastMessageId;

    if (
      !previousLastMessageId ||
      previousLastMessageId !== lastMessageId ||
      stickToBottomRef.current
    ) {
      viewport.scrollTop = viewport.scrollHeight;
      syncScrollState();
    }
  }, [lastMessageId, lastMessageSignature, orderedMessages.length]);

  useEffect(() => {
    if (!hasMore || loadingOlder || !onLoadOlder) return;
    const viewport = viewportRef.current;
    const sentinel = topSentinelRef.current;
    if (!viewport || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onLoadOlder();
      },
      { root: viewport, rootMargin: "96px 0px 0px 0px", threshold: 0.01 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingOlder, onLoadOlder]);

  if (loading) return <LoadingState label="Loading chat..." />;
  if (error) return <ErrorState title="Unable to load chat" message={error} />;
  if (messages.length === 0 && !skeleton) {
    return (
      <EmptyState
        title="No messages yet"
        description="Describe what you want to adjust, like colors, hero copy, or a new section."
      />
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <section
        id="project-messages-viewport"
        ref={viewportRef}
        className="builder-scrollbar-hidden flex h-full min-h-0 flex-1 flex-col gap-sm overflow-y-auto pr-xs scroll-smooth"
        aria-label="Message history"
        onScroll={() => {
          syncScrollState();
        }}
      >
        <div ref={topSentinelRef} className="h-px" aria-hidden="true" />
        {hasMore ? (
          <button
            className="mx-auto inline-flex items-center rounded-pill border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-sm py-xxs text-[11px] text-[var(--app-muted)] transition-colors duration-200 hover:border-[var(--app-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={onLoadOlder}
            disabled={loadingOlder}
            aria-busy={loadingOlder}
          >
            {loadingOlder ? "Loading older messages..." : "Load older messages"}
          </button>
        ) : null}
        <div ref={messageListRef} className="flex flex-col gap-sm">
          {renderItems.map((item) =>
            item.type === "single" ? (
              <div key={item.message.id} data-message-bubble="true">
                <MessageBubble message={item.message} onRetry={onRetryMessage} />
              </div>
            ) : (
              <div
                key={item.runId}
                data-run-group={item.runId}
                className="flex flex-col gap-sm border-l border-[var(--app-border-soft)] pl-sm"
              >
                {item.messages.map((message) => (
                  <div key={message.id} data-message-bubble="true">
                    <MessageBubble message={message} onRetry={onRetryMessage} />
                  </div>
                ))}
              </div>
            ),
          )}
          {skeleton ? (
            <div data-skeleton-bubble="true">
              <SkeletonMessageBubble skeleton={skeleton} />
            </div>
          ) : null}
        </div>
      </section>

      <button
        type="button"
        onClick={() => {
          const viewport = viewportRef.current;
          if (!viewport) return;
          stickToBottomRef.current = true;
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
          setShowJumpToLatest(false);
        }}
        className={`pointer-events-auto absolute bottom-md right-md inline-flex items-center gap-xs rounded-pill border border-[var(--app-border-strong)] bg-[var(--app-panel-bg)] px-sm py-xs text-[12px] font-medium text-[var(--app-panel-text)] shadow-[0_12px_32px_rgba(0,0,0,0.18)] transition-all duration-200 ease-out hover:-translate-y-px hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] ${showJumpToLatest ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}
        aria-hidden={!showJumpToLatest}
        tabIndex={showJumpToLatest ? 0 : -1}
      >
        <ArrowDown className="h-4 w-4 text-[var(--app-icon)] transition-transform duration-200" />
        <span>Jump to latest</span>
      </button>
    </div>
  );
}
