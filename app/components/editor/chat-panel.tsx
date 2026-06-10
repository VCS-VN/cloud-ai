import { useRef, type HTMLAttributes } from "react";
import { useAutoScroll } from "./use-auto-scroll";

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  createdAt: string;
}

interface ChatPanelProps extends HTMLAttributes<HTMLDivElement> {
  projectName?: string;
  messages?: ChatMessage[];
  inputPlaceholder?: string;
  onSend?: (content: string) => void;
}

export function ChatPanel({
  projectName = "Untitled Project",
  messages = [],
  inputPlaceholder = "Type a message...",
  onSend,
  className = "",
  ...rest
}: ChatPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { containerRef, isNearBottom, scrollToBottom } = useAutoScroll({
    enabled: true,
    threshold: 150,
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const value = e.currentTarget.value.trim();
      if (value && onSend) {
        onSend(value);
        e.currentTarget.value = "";
        requestAnimationFrame(() => scrollToBottom());
      }
    }
  };

  return (
    <div
      className={`flex flex-col h-full bg-[var(--app-panel)] text-[var(--app-text)] ${className}`}
      {...rest}
    >
      {/* Project Header */}
      <div className="flex-shrink-0 flex items-center gap-2 px-6 py-4 border-b border-[var(--app-border)]">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--color-chalk))] text-[rgb(var(--color-ink))] font-mono text-caption">
          {projectName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-h3 leading-tight tracking-tight truncate-safe">
            {projectName}
          </h2>
        </div>
      </div>

      {/* Message List — the ONLY scrollable element */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 scroll-smooth"
      >
        <div className="flex flex-col gap-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-xxl text-center">
              <p className="m-0 text-body-sm text-[var(--app-muted)]">
                No messages yet
              </p>
              <p className="m-0 text-body-sm text-[var(--app-subtle)]">
                Start the conversation below
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-[var(--app-selected-bg)] text-[var(--app-selected-text)]"
                      : "bg-[var(--app-surface)] text-[var(--app-text)]"
                  }`}
                >
                  <p className="m-0 text-body leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Input */}
      <div className="flex-shrink-0 border-t border-[var(--app-composer-border)] px-4 py-4">
        <div className="flex items-end gap-1">
          <textarea
            ref={inputRef}
            rows={1}
            placeholder={inputPlaceholder}
            onKeyDown={handleKeyDown}
            className="flex-1 resize-none rounded-md border border-[var(--app-composer-border)] bg-[var(--app-control)] px-2 py-2 text-body text-[var(--app-text)] placeholder:text-[var(--app-composer-placeholder)] outline-none transition-colors duration-150 focus:border-[var(--app-composer-border-focus)] focus:shadow-[0_0_0_3px_rgb(0_0_0_/_0.08)]"
            aria-label="Chat message input"
          />
          <button
            type="button"
            onClick={() => {
              if (inputRef.current) {
                const value = inputRef.current.value.trim();
                if (value && onSend) {
                  onSend(value);
                  inputRef.current.value = "";
                  requestAnimationFrame(() => scrollToBottom());
                }
              }
            }}
            className="flex-shrink-0 rounded-pill bg-[var(--app-pill-bg)] px-6 py-2 text-ui-sm text-[var(--app-pill-text)] transition-colors duration-150 hover:bg-[var(--app-pill-hover)]"
            aria-label="Send message"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2.5 2L13.5 8L2.5 14V8.5L9 8L2.5 7.5V2Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
