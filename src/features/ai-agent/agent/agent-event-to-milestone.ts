import type { AgentStreamEvent } from "./agent-events";
import type { ChangePlan } from "../project/project-state.schema";
import type { AgentMessageKind } from "@/shared/project-types";
import { sanitizeForUser } from "./user-facing-presenter";

const FILE_LIST_LIMIT = 10;

export type MilestoneDecision = {
  kind: AgentMessageKind;
  content: string;
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
  const files = plan.operations
    .filter((op) => FILE_OPERATION_TYPES.has(op.type) && op.path)
    .map((op) => op.path as string);

  if (files.length === 0) return summary;

  const shown = files.slice(0, FILE_LIST_LIMIT);
  const remaining = files.length - shown.length;
  const lines = shown.map((path) => `- ${path}`);
  if (remaining > 0) lines.push(`- +${remaining} more`);

  return `${summary}\n\nWill update:\n${lines.join("\n")}`;
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
