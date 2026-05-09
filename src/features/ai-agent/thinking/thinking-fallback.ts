import type {
  StructuredThinkingInput,
  StructuredThinkingResult,
  ThinkingInput,
  ThinkingResult,
} from "./thinking.schema";
import {
  detectHardClarificationBlock,
  inferExecutionModeFromPrompt,
} from "./storefront-prompt-policy";

export function createHeuristicThinkingResult(
  input: ThinkingInput,
): ThinkingResult {
  const now = Date.now().toString(36);
  const status = input.projectState?.status ?? input.projectContext.status;
  const isInit =
    status === "empty" ||
    /\b(tạo|create|init|build|new)\b/i.test(input.userPrompt);
  const normalizedGoal = isInit
    ? `Initialize storefront from user request: ${input.userPrompt}`
    : `Understand and prepare storefront update: ${input.userPrompt}`;
  const lifecycleIntent = isInit ? "init_project" : "update_project";
  const taskType = isInit
    ? "init_storefront_project"
    : "incremental_source_update";
  const wishId = `wish_${now}`;

  return {
    id: `thinking_${now}`,
    projectId: input.projectId,
    runId: input.runId,
    userFacingUnderstanding: `Mình hiểu bạn muốn ${input.userPrompt.replace(/[.!?。]+$/, "")}.`,
    promptClassification: {
      lifecycleIntent,
      confidence: 0.65,
      reasonSummary:
        "Created from safe local fallback because structured provider output was unavailable.",
    },
    extractedWishes: [
      {
        id: wishId,
        type: "explicit",
        description: input.userPrompt,
        priority: "must_have",
        confidence: 0.7,
        evidence: input.userPrompt,
      },
    ],
    ecommerceInterpretation: {
      primaryGoal: isInit ? "project_initialization" : "conversion",
      affectedPages: isInit ? [] : ["/"],
      affectedSections: [],
      affectedFeatures: [],
      affectedDataModels: [],
      expectedBusinessImpact:
        "Clarifies the storefront request before planning or source changes.",
    },
    constraints: {
      explicitConstraints: [],
      inferredConstraints: [
        "Preserve existing storefront behavior unless the user explicitly asks to change it.",
      ],
      doNotChange: input.projectState?.constraints.doNotChange ?? [],
      styleConstraints: [],
      technicalConstraints: [],
    },
    assumptions: [],
    ambiguities: [],
    conflicts: [],
    riskAssessment: {
      level: "low",
      reasons: ["Thinking-only interpretation is read-only."],
      requiresUserConfirmation: false,
    },
    suggestedAcceptanceCriteria: [
      "The agent summarizes the request before planning.",
    ],
    downstreamTask: {
      taskId: `task_${now}`,
      projectId: input.projectId,
      runId: input.runId,
      taskType,
      normalizedGoal,
      userPrompt: input.userPrompt,
      requirements: [
        {
          id: `req_${now}`,
          description: normalizedGoal,
          sourceWishId: wishId,
          priority: "must_have",
          acceptanceCriteria: [
            "A safe understanding summary is available before downstream planning.",
          ],
        },
      ],
      targetScope: {
        pages: isInit ? [] : ["/"],
        sections: [],
        features: [],
        filesHint: [],
        dataModels: [],
      },
      executionPolicy: {
        allowInitSource: isInit,
        allowPatchSource: !isInit,
        allowPackageChange: false,
        allowConfigChange: false,
        allowPreviewRestart: false,
        requireHumanConfirmation: false,
      },
    },
  };
}

export function createClarificationStructuredThinkingResult(
  input: StructuredThinkingInput,
  reason: string,
): StructuredThinkingResult {
  const mode = inferExecutionModeFromPrompt(input.userPrompt);
  const block = detectHardClarificationBlock({
    userPrompt: input.userPrompt,
    projectState: input.projectState,
    hasInitializedSource: input.runtimeContext.hasInitializedSource,
  });
  if (!block && mode === "apply")
    return createApplyStructuredThinkingResult(input, reason);

  return {
    intent: "unknown",
    confidence: 1,
    language: "unknown",
    userWish: {
      rawPrompt: input.userPrompt,
      explicitRequests: [input.userPrompt],
      implicitRequests: [],
      inferredEcommerceGoals: [],
      outOfScopeRequests: [],
    },
    ecommerceContext: {
      storeType: "unknown",
      affectedPages: [],
      affectedSections: [],
      affectedFeatures: [],
      affectedEntities: [],
      conversionGoal: "unknown",
    },
    projectAction: {
      shouldInitProject: false,
      shouldModifyExistingProject: false,
      shouldAskClarification: true,
      clarificationQuestion:
        "Bạn có thể mô tả rõ hơn thay đổi storefront bạn muốn thực hiện không?",
      requiresSourceInit: false,
      requiresPatchGeneration: false,
      requiresValidation: false,
      requiresPreviewRefresh: false,
    },
    constraints: {
      preserveExistingDesign: true,
      preserveExistingFeatures: true,
      requestedStackChange: false,
      requestedDestructiveChange: false,
      forbiddenActions: [],
    },
    risk: {
      level: "medium",
      reasons: [reason],
    },
    normalizedTask: {
      title: "Clarify storefront request",
      description:
        "Ask for clarification before any downstream planning or source execution.",
      acceptanceCriteria: [
        "No downstream execution starts until the user clarifies the request.",
      ],
      implementationHints: [],
    },
    downstream: {
      recommendedNextStep: "ask_clarification",
      priority: "normal",
    },
  };
}

function createApplyStructuredThinkingResult(
  input: StructuredThinkingInput,
  reason: string,
): StructuredThinkingResult {
  return {
    intent: "modify_design",
    confidence: 0.55,
    language: "unknown",
    userWish: {
      rawPrompt: input.userPrompt,
      explicitRequests: [input.userPrompt],
      implicitRequests: [
        "Infer a safe storefront improvement from current project context.",
      ],
      inferredEcommerceGoals: [
        "Improve the current e-commerce storefront using reasonable defaults.",
      ],
      outOfScopeRequests: [],
    },
    ecommerceContext: {
      storeType: "unknown",
      affectedPages: ["/"],
      affectedSections: ["homepage", "theme"],
      affectedFeatures: [],
      affectedEntities: [],
      conversionGoal: "improve_brand_perception",
    },
    projectAction: {
      shouldInitProject: false,
      shouldModifyExistingProject: true,
      shouldAskClarification: false,
      clarificationQuestion: null,
      requiresSourceInit: false,
      requiresPatchGeneration: true,
      requiresValidation: true,
      requiresPreviewRefresh: true,
    },
    constraints: {
      preserveExistingDesign: true,
      preserveExistingFeatures: true,
      requestedStackChange: false,
      requestedDestructiveChange: false,
      forbiddenActions: [],
    },
    risk: {
      level: "low",
      reasons: [`Provider fallback normalized to apply mode: ${reason}`],
    },
    normalizedTask: {
      title: "Apply storefront improvement",
      description:
        "Mình sẽ áp dụng thay đổi theo hướng cải thiện storefront dựa trên ngữ cảnh hiện tại.",
      acceptanceCriteria: [
        "Current storefront code is inspected before mutation.",
        "The change uses a minimal patch and preserves existing storefront behavior.",
        "Validation runs after mutation or reports a specific blocker.",
      ],
      implementationHints: [
        "Inspect existing components before patching.",
        "Prefer existing components and styles.",
      ],
    },
    downstream: {
      recommendedNextStep: "generate_patch",
      priority: "normal",
    },
  };
}
