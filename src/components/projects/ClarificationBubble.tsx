import type { Message } from "@/shared/project-types";

type ClarificationBubbleProps = {
  message: Message;
};

/**
 * T050: Text-only clarification question display.
 * No interactive options — user replies by typing a new message.
 */
export function ClarificationBubble({ message }: ClarificationBubbleProps) {
  return (
    <div className="flex flex-col gap-xs">
      <p className="text-[12px] leading-[1.4] text-[var(--app-panel-text)] whitespace-pre-wrap">
        {message.content}
      </p>
      <p className="text-[11px] text-[var(--app-icon-muted)] italic">
        Hãy trả lời bằng tin nhắn mới để tiếp tục.
      </p>
    </div>
  );
}
