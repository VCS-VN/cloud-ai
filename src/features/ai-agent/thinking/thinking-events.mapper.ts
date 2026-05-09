import type { AgentStreamEvent } from "../agent/agent-events";
import type { ThinkingResult } from "./thinking.schema";

export function mapThinkingToUserWishEvent(thinking: ThinkingResult): AgentStreamEvent {
  return {
    type: "user_wish_extracted",
    runId: thinking.runId,
    understanding: thinking.userFacingUnderstanding,
    wishes: thinking.extractedWishes.map((wish) => ({
      type: wish.type,
      description: wish.description,
      priority: wish.priority,
    })),
  };
}

export function mapThinkingToCompletedEvent(thinking: ThinkingResult): AgentStreamEvent {
  return {
    type: "thinking_completed",
    runId: thinking.runId,
    taskType: thinking.downstreamTask.taskType,
    normalizedGoal: thinking.downstreamTask.normalizedGoal,
    riskLevel: thinking.riskAssessment.level,
  };
}
