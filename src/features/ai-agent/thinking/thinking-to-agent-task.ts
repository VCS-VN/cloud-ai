import type { StructuredAgentTask, StructuredThinkingResult } from "./thinking.schema";

export function thinkingResultToAgentTask(input: {
  projectId: string;
  userId: string;
  sourcePrompt: string;
  thinkingResult: StructuredThinkingResult;
}): StructuredAgentTask {
  const { projectId, userId, sourcePrompt, thinkingResult } = input;

  return {
    projectId,
    userId,
    sourcePrompt,
    intent: thinkingResult.intent,
    title: thinkingResult.normalizedTask.title,
    description: thinkingResult.normalizedTask.description,
    ecommerceGoal: thinkingResult.ecommerceContext.conversionGoal,
    affectedPages: thinkingResult.ecommerceContext.affectedPages,
    affectedSections: thinkingResult.ecommerceContext.affectedSections,
    affectedFeatures: thinkingResult.ecommerceContext.affectedFeatures,
    affectedEntities: thinkingResult.ecommerceContext.affectedEntities,
    acceptanceCriteria: thinkingResult.normalizedTask.acceptanceCriteria,
    implementationHints: thinkingResult.normalizedTask.implementationHints,
    riskLevel: thinkingResult.risk.level,
    nextStep: thinkingResult.downstream.recommendedNextStep,
    requires: {
      sourceInit: thinkingResult.projectAction.requiresSourceInit,
      patchGeneration: thinkingResult.projectAction.requiresPatchGeneration,
      validation: thinkingResult.projectAction.requiresValidation,
      previewRefresh: thinkingResult.projectAction.requiresPreviewRefresh,
      clarification: thinkingResult.projectAction.shouldAskClarification,
    },
    executionMode: thinkingResult.projectAction.requiresPatchGeneration ? "apply" : thinkingResult.downstream.recommendedNextStep === "explain_only" ? "explain" : thinkingResult.downstream.recommendedNextStep === "create_plan" ? "plan" : undefined,
    actionPolicy: {
      shouldApplyCode: thinkingResult.projectAction.requiresPatchGeneration,
      shouldCreatePlanOnly: thinkingResult.downstream.recommendedNextStep === "create_plan",
      shouldAskClarification: thinkingResult.projectAction.shouldAskClarification,
      clarificationQuestion: thinkingResult.projectAction.clarificationQuestion,
      clarificationReason: thinkingResult.risk.reasons.join("; ") || null,
    },
    implementationBias: {
      preferMinimalPatch: true,
      preserveExistingDesignDirection: thinkingResult.constraints.preserveExistingDesign,
      useExistingComponentsFirst: true,
      avoidFullRewrite: !thinkingResult.constraints.requestedDestructiveChange,
    },
  };
}
