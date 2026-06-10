import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  onSelectOption?: (
    messageId: string,
    optionId: string,
  ) => Promise<boolean | void>;
  onPlanAction?: (
    message: Message,
    action: "approve" | "reject",
  ) => Promise<void>;
  awaitingPlanReviewRunId?: string | null;
  onSubmitFreeText?: (
    message: Message,
    freeText: string,
  ) => Promise<boolean | void>;
};

const STICK_TO_BOTTOM_THRESHOLD = 72;
const MIN_MESSAGE_HEIGHT_FALLBACK = 56;
const JUMP_TO_LATEST_MESSAGE_COUNT = 10;

type RenderItem =
  | { type: "day-divider"; key: string; label: string }
  | { type: "single"; message: Message }
  | { type: "run-group"; runId: string; messages: Message[] };

/**
 * Groups consecutive agent messages that share a runId into a single
 * border-left wrapper. User messages always render standalone. Order is
 * preserved by createdAt (already sorted by caller).
 */
export function buildRenderItems(messages: Message[]): RenderItem[] {
  const items: RenderItem[] = [];
  let currentDayKey: string | null = null;
  for (const message of messages) {
    const dayKey = getMessageDayKey(message.createdAt);
    if (dayKey !== currentDayKey) {
      currentDayKey = dayKey;
      items.push({
        type: "day-divider",
        key: dayKey,
        label: formatDayDivider(message.createdAt),
      });
    }

    if (message.role !== "agent" || !message.runId) {
      items.push({ type: "single", message });
      continue;
    }
    const last = items[items.length - 1];
    if (last && last.type === "run-group" && last.runId === message.runId) {
      last.messages.push(message);
    } else {
      items.push({
        type: "run-group",
        runId: message.runId,
        messages: [message],
      });
    }
  }
  return items;
}

function getMessageDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayDivider(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Conversation";

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  if (getMessageDayKey(iso) === getMessageDayKey(today.toISOString())) {
    return `Today · ${time}`;
  }
  if (getMessageDayKey(iso) === getMessageDayKey(yesterday.toISOString())) {
    return `Yesterday · ${time}`;
  }
  return `${d.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit", year: "numeric" })} · ${time}`;
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
  onSelectOption,
  onPlanAction,
  awaitingPlanReviewRunId,
  onSubmitFreeText,
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
  const renderItems = useMemo(
    () => buildRenderItems(orderedMessages),
    [orderedMessages],
  );
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
        className="builder-scrollbar-hidden flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-1 py-3 scroll-smooth"
        aria-label="Message history"
        onScroll={() => {
          syncScrollState();
        }}
      >
        <div ref={topSentinelRef} className="h-px" aria-hidden="true" />
        {hasMore ? (
          <Button
            variant="unstyled"
            className="load-older-btn"
            type="button"
            onClick={onLoadOlder}
            disabled={loadingOlder}
            aria-busy={loadingOlder}
          >
            {loadingOlder ? "Loading..." : "Load older messages"}
          </Button>
        ) : null}
        <div ref={messageListRef} className="flex flex-col gap-7">
          {renderItems.map((item) =>
            item.type === "day-divider" ? (
              <div key={`day-${item.key}`} className="msg-day-divider">
                <span className="msg-day-label">{item.label}</span>
              </div>
            ) : item.type === "single" ? (
              <div key={item.message.id} data-message-bubble="true">
                <MessageBubble
                  message={item.message}
                  onRetry={onRetryMessage}
                  onSelectOption={onSelectOption}
                  onPlanAction={onPlanAction}
                  onSubmitFreeText={onSubmitFreeText}
                  planAwaitingReview={
                    item.message.kind === "plan" &&
                    awaitingPlanReviewRunId !== undefined &&
                    item.message.runId === awaitingPlanReviewRunId
                  }
                />
              </div>
            ) : (
              <div
                key={item.runId}
                data-run-group={item.runId}
                // className="flex flex-col gap-4 border-l border-hairline-soft pl-4"
              >
                {item.messages.map((message) => (
                  <div key={message.id} data-message-bubble="true">
                    <MessageBubble
                      message={message}
                      onRetry={onRetryMessage}
                      onSelectOption={onSelectOption}
                      onPlanAction={onPlanAction}
                      onSubmitFreeText={onSubmitFreeText}
                      planAwaitingReview={
                        message.kind === "plan" &&
                        awaitingPlanReviewRunId !== undefined &&
                        item.runId === awaitingPlanReviewRunId
                      }
                    />
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

      <Button
        variant="unstyled"
        type="button"
        onClick={() => {
          const viewport = viewportRef.current;
          if (!viewport) return;
          stickToBottomRef.current = true;
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
          setShowJumpToLatest(false);
        }}
        className={`jump-latest ${showJumpToLatest ? "jump-latest-visible" : ""}`}
        aria-hidden={!showJumpToLatest}
        tabIndex={showJumpToLatest ? 0 : -1}
      >
        <ArrowDown aria-hidden="true" size={14} />
        <span>Jump to latest</span>
      </Button>
    </div>
  );
}
