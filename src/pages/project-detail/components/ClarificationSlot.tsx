import { HelpCircle } from "lucide-react";
import { AgentBody } from "@/components/projects/MessageBubble";
import type { Message } from "@/shared/project-types";

// The clarification / plan-review form, surfaced at the position the tasks
// checklist used to occupy. It renders the pending interactive message using
// the same body renderers as the chat bubble, so design-variant pickers,
// skill-clarification lists, free-text clarifications and plan reviews all
// behave identically — they've just moved out of the message stream and into
// this fixed slot. Renders nothing when no clarification is pending.
export function ClarificationSlot({
  message,
  planAwaitingReview,
  onSelectOption,
  onPlanAction,
  onSubmitFreeText,
}: {
  message: Message | null;
  planAwaitingReview: boolean;
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
  if (!message) return null;

  return (
    <section
      aria-label="Agent needs your input"
      className="rounded-lg border border-hairline bg-surface"
    >
      <div className="flex items-center gap-1.5 border-b border-hairline px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-subtle">
        <HelpCircle aria-hidden="true" size={12} />
        Needs your input
      </div>
      <div className="max-h-[42vh] overflow-y-auto px-3 py-2.5">
        <AgentBody
          message={message}
          planAwaitingReview={planAwaitingReview}
          onSelectOption={onSelectOption}
          onPlanAction={onPlanAction}
          onSubmitFreeText={onSubmitFreeText}
        />
      </div>
    </section>
  );
}
