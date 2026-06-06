import type { AgentStreamEvent } from "./agent-events";
import type { ChangePlan } from "@/features/projects/legacy/project-state.schema";
import type { AgentMessageKind, AgentQuestionMetadata } from "@/shared/project-types";
import { sanitizeForUser } from "./user-facing-presenter";

export type MilestoneDecision = {
  kind: AgentMessageKind;
  content: string;
  metadata?: AgentQuestionMetadata | null;
};

const FILE_OPERATION_TYPES = new Set([
  "create_file",
  "modify_file",
  "delete_file",
]);

/**
 * A plan is worth persisting only when it actually touches files.
 * update_state_only / explain_only plans carry no file operations and are skipped.
 */
function planHasFileOperations(plan: ChangePlan): boolean {
  if (plan.changeType === "update_state_only" || plan.changeType === "explain_only") {
    return false;
  }
  return plan.operations.some((op) => FILE_OPERATION_TYPES.has(op.type) && op.path);
}

function buildPlanContent(plan: ChangePlan): string {
  const summary = sanitizeForUser(plan.summary) || "Planned changes to your storefront.";
  const fileCount = plan.operations.filter(
    (op) => FILE_OPERATION_TYPES.has(op.type) && op.path,
  ).length;

  if (fileCount === 0) return summary;

  const noun = fileCount === 1 ? "update" : "updates";
  return `${summary}\n\nPreparing ${fileCount} ${noun} across your storefront.`;
}

/**
 * Decides whether an AgentStreamEvent should be persisted as a milestone message.
 * Returns undefined for events that only drive the ephemeral skeleton.
 *
 * Note: the `answer` milestone is NOT produced here — it is created lazily by
 * MessageService when the first `assistant_message_delta` arrives, then streamed.
 * The `error` outcome is also handled in MessageService (persistErrorOutcome),
 * which builds a friendly, language-aware message and never leaks raw details.
 */
export function decideMilestone(event: AgentStreamEvent): MilestoneDecision | undefined {
  switch (event.type) {
    case "plan_created": {
      if (!planHasFileOperations(event.plan)) return undefined;
      return { kind: "plan", content: buildPlanContent(event.plan) };
    }
    case "clarification_required":
    case "thinking_needs_clarification": {
      const question = sanitizeForUser(event.question);
      return {
        kind: "clarification",
        content: question || "Could you share a bit more detail so I can continue?",
        metadata: event.metadata as AgentQuestionMetadata | null | undefined,
      };
    }
    case "human_review_required": {
      const reason = sanitizeForUser(event.reason);
      return {
        kind: "review_required",
        content: reason
          ? `I'd like your review before continuing: ${reason}`
          : "I'd like your review before continuing.",
      };
    }
    default:
      return undefined;
  }
}
