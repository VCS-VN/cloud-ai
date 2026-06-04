import type { StructuredThinkingResult } from "./thinking.schema";
import { THINKING_LAYER_CONFIG } from "./thinking-config";

export type ThinkingBusinessValidationResult = {
  ok: boolean;
  errors: string[];
};

export function validateThinkingBusinessRules(input: {
  result: StructuredThinkingResult;
  hasInitializedSource: boolean;
}): ThinkingBusinessValidationResult {
  const { result, hasInitializedSource } = input;
  const errors: string[] = [];

  if (result.projectAction.shouldInitProject && result.projectAction.shouldModifyExistingProject) {
    errors.push("Cannot initialize and modify an existing project at the same time.");
  }

  if (result.projectAction.shouldAskClarification && !result.projectAction.clarificationQuestion?.trim()) {
    errors.push("Clarification question is required when shouldAskClarification is true.");
  }

  if (result.projectAction.shouldAskClarification && result.projectAction.requiresPatchGeneration) {
    errors.push("Clarification-blocked requests must not require patch generation.");
  }

  if (result.projectAction.shouldAskClarification && result.projectAction.shouldModifyExistingProject) {
    errors.push("Clarification-blocked requests must not modify the existing project.");
  }

  const options = result.projectAction.clarificationOptions;
  if (!result.projectAction.shouldAskClarification && options.length > 0) {
    errors.push("Clarification options must only be present when asking clarification.");
  }

  if (options.length > 0) {
    if (options.length < 2 || options.length > 4) {
      errors.push("Clarification options must include 2-4 choices.");
    }
    const recommendedCount = options.filter((option) => option.recommended).length;
    if (recommendedCount !== 1) {
      errors.push("Exactly one clarification option must be recommended.");
    }
  }

  if (result.confidence < THINKING_LAYER_CONFIG.confidence.askClarificationBelow && !result.projectAction.shouldAskClarification) {
    errors.push("Low-confidence requests require clarification.");
  }

  if (result.confidence < THINKING_LAYER_CONFIG.confidence.askClarificationBelow && result.downstream.recommendedNextStep !== "ask_clarification") {
    errors.push("Low-confidence requests must ask clarification before downstream work.");
  }

  if (!hasInitializedSource && result.intent !== "init_project" && result.downstream.recommendedNextStep !== "ask_clarification") {
    errors.push("Project is not initialized. Non-init intent must ask clarification or init source.");
  }

  if (hasInitializedSource && result.intent === "init_project" && !result.constraints.requestedDestructiveChange) {
    errors.push("Initialized project should not be classified as init_project unless user requested rebuild.");
  }

  if (result.constraints.requestedStackChange && !result.projectAction.shouldAskClarification) {
    errors.push("Stack changes require clarification.");
  }

  if (result.constraints.requestedStackChange && result.downstream.recommendedNextStep !== "ask_clarification") {
    errors.push("Stack changes must ask clarification before downstream work.");
  }

  if (result.constraints.requestedDestructiveChange && result.risk.level !== "high") {
    errors.push("Destructive changes must be marked high risk.");
  }

  if (result.constraints.requestedDestructiveChange && !result.projectAction.shouldAskClarification) {
    errors.push("Destructive changes require clarification.");
  }

  if (result.constraints.requestedDestructiveChange && result.downstream.recommendedNextStep !== "ask_clarification") {
    errors.push("Destructive changes must ask clarification before downstream work.");
  }

  if (result.constraints.forbiddenActions.length > 0 && !result.projectAction.shouldAskClarification) {
    errors.push("Forbidden actions require clarification or safe redirect.");
  }

  if (result.constraints.forbiddenActions.length > 0 && !isSafeRiskNextStep(result.downstream.recommendedNextStep)) {
    errors.push("Forbidden actions must stop downstream work.");
  }

  if (result.risk.level === "high" && THINKING_LAYER_CONFIG.riskPolicy.forceClarificationForHighRisk && !result.projectAction.shouldAskClarification) {
    errors.push("High-risk requests require clarification.");
  }

  if (result.risk.level === "high" && THINKING_LAYER_CONFIG.riskPolicy.forceClarificationForHighRisk && !isSafeRiskNextStep(result.downstream.recommendedNextStep)) {
    errors.push("High-risk requests must stop downstream work.");
  }

  if (result.intent === "add_feature" && result.ecommerceContext.affectedFeatures.length === 0) {
    errors.push("Feature changes must include at least one affected feature.");
  }

  return { ok: errors.length === 0, errors };
}

function isSafeRiskNextStep(nextStep: StructuredThinkingResult["downstream"]["recommendedNextStep"]): boolean {
  return (THINKING_LAYER_CONFIG.riskPolicy.safeNextSteps as readonly string[]).includes(nextStep);
}
