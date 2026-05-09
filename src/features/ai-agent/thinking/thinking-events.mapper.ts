import type { AgentStreamEvent } from "../agent/agent-events";
import type { StructuredThinkingResult, ThinkingResult } from "./thinking.schema";

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
  const storefront = thinking.downstreamTask.storefront;
  return {
    type: "thinking_completed",
    runId: thinking.runId,
    taskType: thinking.downstreamTask.taskType,
    normalizedGoal: thinking.downstreamTask.normalizedGoal,
    riskLevel: thinking.riskAssessment.level,
    summary: storefront?.actionPolicy.shouldAskClarification
      ? storefront.actionPolicy.clarificationQuestion ?? thinking.userFacingUnderstanding
      : thinking.userFacingUnderstanding,
    intent: builderIntentNameFromThinking(thinking),
    confidence: thinking.promptClassification.confidence,
    executionMode: storefront?.executionMode,
    shouldApplyCode: storefront?.actionPolicy.shouldApplyCode,
    affectedPages: thinking.ecommerceInterpretation.affectedPages,
    affectedFeatures: thinking.ecommerceInterpretation.affectedFeatures,
    conversionGoal: thinking.ecommerceInterpretation.primaryGoal,
  };
}

export function toSanitizedThinkingEvent(result: StructuredThinkingResult) {
  return {
    intent: result.intent,
    confidence: result.confidence,
    summary: result.normalizedTask.description,
    affectedPages: result.ecommerceContext.affectedPages,
    affectedFeatures: result.ecommerceContext.affectedFeatures,
    conversionGoal: result.ecommerceContext.conversionGoal,
    riskLevel: result.risk.level,
  };
}

function builderIntentNameFromThinking(thinking: ThinkingResult) {
  const taskType = thinking.downstreamTask.taskType;
  if (taskType === "init_storefront_project") return "init_project";
  if (taskType === "content_update") return "modify_content";
  if (taskType === "design_update") return "modify_design";
  if (taskType === "product_data_update") return "modify_products";
  if (taskType === "bug_fix") return "fix_bug";
  if (taskType === "answer_question") return "explain_project";
  if (taskType === "needs_clarification") return "unknown";
  return "add_feature";
}
