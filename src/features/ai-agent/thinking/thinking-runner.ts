import type { AgentConfig } from "../agent/agent-config";
import type { AgentRun, ProjectState } from "../project/project-state.schema";
import { validateThinkingBusinessRules } from "./thinking-business-validator";
import { THINKING_LAYER_CONFIG } from "./thinking-config";
import {
  createClarificationStructuredThinkingResult,
  createHeuristicThinkingResult,
} from "./thinking-fallback";
import { ThinkingResultJsonSchema } from "./thinking-json-schema";
import { preflightUserPrompt } from "./thinking-preflight";
import {
  THINKING_LAYER_DEVELOPER_PROMPT,
  THINKING_LAYER_SYSTEM_PROMPT,
} from "./thinking.prompt";
import {
  structuredThinkingResultSchema,
  thinkingInputSchema,
  thinkingResultSchema,
  type StructuredThinkingInput,
  type StructuredThinkingResult,
  type ThinkingInput,
  type ThinkingResult,
} from "./thinking.schema";
import {
  normalizeStructuredThinkingForProjectDetail,
  toStorefrontThinkingResult,
} from "./storefront-thinking-normalizer";
import {
  detectHardClarificationBlock,
  inferStorefrontIntent,
} from "./storefront-prompt-policy";

export type ThinkingProvider = {
  parseStructured<TInput, TOutput>(args: {
    model: string;
    system: string;
    user: TInput;
    schemaName: string;
    schema: unknown;
  }): Promise<TOutput>;
};

export type RunThinkingLayerInput = {
  projectId: string;
  run: AgentRun;
  userId?: string;
  userPrompt: string;
  projectState: ProjectState | null;
  provider?: ThinkingProvider;
  agentConfig?: AgentConfig;
  saveResult?: (result: ThinkingResult) => Promise<void> | void;
};

export async function runThinkingLayer(
  input: RunThinkingLayerInput,
): Promise<ThinkingResult> {
  const maxPromptChars = input.agentConfig?.maxPromptChars ?? 12_000;
  const preflight = preflightUserPrompt(input.userPrompt, maxPromptChars);
  const thinkingInput = buildThinkingInput({
    ...input,
    userPrompt: preflight.sanitizedPrompt || input.userPrompt,
  });

  if (preflight.blocked) {
    const blocked = buildBlockedThinkingResult(
      thinkingInput,
      preflight.blockReason ?? "The prompt cannot be processed safely.",
    );
    await input.saveResult?.(blocked);
    return blocked;
  }

  const result = input.provider
    ? await extractProviderThinkingResult(
        input.provider,
        thinkingInput,
        input.agentConfig?.plannerModel ?? THINKING_LAYER_CONFIG.model,
      )
    : createHeuristicThinkingResult(thinkingInput);
  const validated = thinkingResultSchema.parse(result);
  await input.saveResult?.(validated);
  return validated;
}

async function extractProviderThinkingResult(
  provider: ThinkingProvider,
  thinkingInput: ThinkingInput,
  model: string,
): Promise<ThinkingResult> {
  const structuredInput = buildStructuredThinkingInput(thinkingInput);
  try {
    const structured = await requestValidatedStructuredThinkingResult({
      provider,
      model,
      thinkingInput: structuredInput,
    });
    const normalized = normalizeStructuredThinkingForProjectDetail({
      thinking: structured,
      thinkingInput: structuredInput,
    });
    return thinkingResultSchema.parse(
      structuredThinkingToLegacyResult(normalized, thinkingInput),
    );
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "thinking_provider_fallback",
        projectId: thinkingInput.projectId,
        runId: thinkingInput.runId,
        error: compactThinkingProviderError(error),
      }),
    );
    const fallback = createClarificationStructuredThinkingResult(
      structuredInput,
      error instanceof Error
        ? error.message
        : "Thinking provider validation failed.",
    );
    const normalized = normalizeStructuredThinkingForProjectDetail({
      thinking: fallback,
      thinkingInput: structuredInput,
    });
    return thinkingResultSchema.parse(
      structuredThinkingToLegacyResult(normalized, thinkingInput),
    );
  }
}

async function requestValidatedStructuredThinkingResult(input: {
  provider: ThinkingProvider;
  model: string;
  thinkingInput: StructuredThinkingInput;
}): Promise<StructuredThinkingResult> {
  const first = await requestStructuredThinkingResult(input);
  const firstValidation = validateThinkingBusinessRules({
    result: first,
    hasInitializedSource:
      input.thinkingInput.runtimeContext.hasInitializedSource,
  });
  if (firstValidation.ok) return first;

  const repaired = await requestStructuredThinkingResult({
    ...input,
    repairInstruction: firstValidation.errors.join("; "),
  });
  const repairedValidation = validateThinkingBusinessRules({
    result: repaired,
    hasInitializedSource:
      input.thinkingInput.runtimeContext.hasInitializedSource,
  });
  if (repairedValidation.ok) return repaired;

  throw new Error(
    `Thinking Result failed business validation: ${repairedValidation.errors.join("; ")}`,
  );
}

async function requestStructuredThinkingResult(input: {
  provider: ThinkingProvider;
  model: string;
  thinkingInput: StructuredThinkingInput;
  repairInstruction?: string;
}): Promise<StructuredThinkingResult> {
  const result = await input.provider.parseStructured<unknown, unknown>({
    model: input.model,
    system: buildStructuredThinkingSystemPrompt(input.repairInstruction),
    user: input.thinkingInput,
    schemaName: "thinking_result",
    schema: ThinkingResultJsonSchema,
  });
  return structuredThinkingResultSchema.parse(
    normalizeProviderStructuredThinkingOutput(result, input.thinkingInput),
  );
}

function buildStructuredThinkingSystemPrompt(repairInstruction?: string) {
  const basePrompt = `${THINKING_LAYER_SYSTEM_PROMPT}\n\n${THINKING_LAYER_DEVELOPER_PROMPT}`;
  if (!repairInstruction) return basePrompt;
  return `${basePrompt}\n\nRepair the previous ThinkingResult. Keep the same user intent and fix only these validation errors: ${repairInstruction}\nReturn only a complete root StructuredThinkingResult object. Do not wrap it in thinking_result, result, data, output, or response.`;
}

export function normalizeProviderStructuredThinkingOutput(
  raw: unknown,
  thinkingInput: StructuredThinkingInput,
): unknown {
  const unwrapped = unwrapStructuredThinkingOutput(raw);
  if (!isRecord(unwrapped)) return synthesizeStructuredThinkingResult(thinkingInput);

  const normalized: Record<string, unknown> = { ...unwrapped };
  normalized.intent = normalizeStructuredIntent(normalized.intent);
  normalized.confidence = normalizeConfidence(normalized.confidence);
  normalized.language = normalizeLanguage(normalized.language);

  const hasRequiredSections = [
    "userWish",
    "ecommerceContext",
    "projectAction",
    "constraints",
    "risk",
    "normalizedTask",
    "downstream",
  ].every((key) => isRecord(normalized[key]));

  if (!hasRequiredSections) {
    const synthesized = synthesizeStructuredThinkingResult(thinkingInput);
    return structuredThinkingResultSchema.parse({
      ...synthesized,
      ...Object.fromEntries(
        Object.entries(normalized).filter(([, value]) => value !== undefined),
      ),
      userWish: isRecord(normalized.userWish)
        ? normalized.userWish
        : synthesized.userWish,
      ecommerceContext: isRecord(normalized.ecommerceContext)
        ? normalized.ecommerceContext
        : synthesized.ecommerceContext,
      projectAction: isRecord(normalized.projectAction)
        ? normalized.projectAction
        : synthesized.projectAction,
      constraints: isRecord(normalized.constraints)
        ? normalized.constraints
        : synthesized.constraints,
      risk: isRecord(normalized.risk) ? normalized.risk : synthesized.risk,
      normalizedTask: isRecord(normalized.normalizedTask)
        ? normalized.normalizedTask
        : synthesized.normalizedTask,
      downstream: isRecord(normalized.downstream)
        ? normalized.downstream
        : synthesized.downstream,
    });
  }

  return normalized;
}

function synthesizeStructuredThinkingResult(
  thinkingInput: StructuredThinkingInput,
): StructuredThinkingResult {
  const block = detectHardClarificationBlock({
    userPrompt: thinkingInput.userPrompt,
    projectState: thinkingInput.projectState,
    hasInitializedSource: thinkingInput.runtimeContext.hasInitializedSource,
  });
  const sourceReady = thinkingInput.runtimeContext.hasInitializedSource;
  const intent = block
    ? "unknown"
    : sourceReady
      ? mapStorefrontIntentForStructured(
          inferStorefrontIntent(thinkingInput.userPrompt, "unknown"),
        )
      : "init_project";
  const description = block?.question ?? `Apply storefront request: ${thinkingInput.userPrompt}`;
  return {
    intent,
    confidence: block ? 1 : 0.55,
    language: "unknown",
    userWish: {
      rawPrompt: thinkingInput.userPrompt,
      explicitRequests: [thinkingInput.userPrompt],
      implicitRequests: block ? [] : ["Use safe e-commerce defaults."],
      inferredEcommerceGoals: block
        ? []
        : ["Improve the current e-commerce storefront."],
      outOfScopeRequests: [],
    },
    ecommerceContext: {
      storeType: "unknown",
      affectedPages: sourceReady ? ["/"] : [],
      affectedSections: sourceReady ? ["homepage"] : [],
      affectedFeatures: [],
      affectedEntities: [],
      conversionGoal: sourceReady ? "improve_brand_perception" : "unknown",
    },
    projectAction: {
      shouldInitProject: !sourceReady && !block,
      shouldModifyExistingProject: sourceReady && !block,
      shouldAskClarification: Boolean(block),
      clarificationQuestion: block?.question ?? null,
      requiresSourceInit: !sourceReady && !block,
      requiresPatchGeneration: sourceReady && !block,
      requiresValidation: !block,
      requiresPreviewRefresh: sourceReady && !block,
    },
    constraints: {
      preserveExistingDesign: true,
      preserveExistingFeatures: true,
      requestedStackChange: false,
      requestedDestructiveChange: block?.type === "destructive",
      forbiddenActions: block?.type === "unsafe" ? [block.reason] : [],
    },
    risk: {
      level: block ? "high" : "low",
      reasons: block ? [block.reason] : ["Recovered malformed provider output."],
    },
    normalizedTask: {
      title: block ? "Clarify storefront request" : "Apply storefront request",
      description,
      acceptanceCriteria: block
        ? ["No project files are mutated until the blocker is resolved."]
        : [
            "Current storefront code is inspected before mutation.",
            "The change uses a minimal patch and preserves existing storefront behavior.",
            "Validation runs after mutation or reports a specific blocker.",
          ],
      implementationHints: block ? [] : ["Inspect existing source before patching."],
    },
    downstream: {
      recommendedNextStep: block
        ? "ask_clarification"
        : sourceReady
          ? "generate_patch"
          : "init_source",
      priority: "normal",
    },
  };
}

function unwrapStructuredThinkingOutput(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  for (const key of ["thinking_result", "result", "data", "output", "response"]) {
    if (isRecord(raw[key])) return raw[key];
  }
  return raw;
}

function normalizeStructuredIntent(value: unknown): StructuredThinkingResult["intent"] {
  if (value === "improve_responsive" || value === "improve_conversion") return "modify_design";
  if (value === "remove_feature") return "modify_content";
  if (
    value === "init_project" ||
    value === "add_feature" ||
    value === "modify_design" ||
    value === "modify_content" ||
    value === "modify_products" ||
    value === "fix_bug" ||
    value === "integrate_service" ||
    value === "explain_project" ||
    value === "unknown"
  ) return value;
  return "unknown";
}

function mapStorefrontIntentForStructured(intent: ReturnType<typeof inferStorefrontIntent>): StructuredThinkingResult["intent"] {
  if (intent === "improve_responsive" || intent === "improve_conversion" || intent === "unknown_storefront_change") return "modify_design";
  if (intent === "remove_feature") return "modify_content";
  return intent;
}

function normalizeConfidence(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return clampConfidence(value);
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return clampConfidence(parsed);
  }
  return 0.55;
}

function clampConfidence(value: number) {
  return Math.min(1, Math.max(0, value));
}

function normalizeLanguage(value: unknown): StructuredThinkingResult["language"] {
  if (value === "vi" || value === "en" || value === "mixed" || value === "unknown") return value;
  return "unknown";
}

function compactThinkingProviderError(error: unknown) {
  if (!(error instanceof Error)) return "Unknown thinking provider error.";
  return error.message.replace(/\s+/g, " ").slice(0, 500);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildThinkingInput(input: RunThinkingLayerInput): ThinkingInput {
  return thinkingInputSchema.parse({
    projectId: input.projectId,
    runId: input.run.id,
    userId: input.userId,
    userPrompt: input.userPrompt.trim(),
    projectState: input.projectState,
    conversationContext: {
      recentUserMessages: [],
      recentAssistantSummaries: [],
    },
    projectContext: {
      status: mapProjectStatus(input.projectState?.status),
      fileManifest: (input.projectState?.fileManifest ?? []).map((file) => ({
        path: file.path,
        purpose: file.purpose,
        kind: mapFileKind(file.kind),
      })),
      recentChanges: (input.projectState?.recentChanges ?? [])
        .slice(0, 5)
        .map((change) => ({
          runId: change.runId,
          userPrompt: change.userPrompt,
          summary: change.summary,
          changedFiles: change.changedFiles,
          validationStatus: change.validationStatus,
        })),
    },
  });
}

export function buildStructuredThinkingInput(
  input: ThinkingInput,
): StructuredThinkingInput {
  return {
    projectId: input.projectId,
    userId: input.userId ?? "anonymous",
    userPrompt: input.userPrompt,
    projectState: compactProjectState(
      input.projectState,
    ) as ProjectState | null,
    recentConversationSummary:
      input.conversationContext.recentAssistantSummaries.at(-1)?.summary ??
      null,
    recentUserMessages: input.conversationContext.recentUserMessages,
    runtimeContext: {
      hasInitializedSource:
        input.projectContext.status !== "empty" &&
        input.projectContext.fileManifest.length > 0,
      hasRunningPreview:
        input.projectContext.previewStatus?.status === "running",
      currentPreviewUrl: input.projectContext.previewStatus?.previewUrl ?? null,
      builderStack: {
        framework: "tanstack-start",
        router: "tanstack-router",
        dataFetching: "tanstack-query",
        ui: "react",
        styling: "tailwindcss",
        bundler: "vite",
        viteMajorVersion: 8,
      },
    },
  };
}

function structuredThinkingToLegacyResult(
  result: StructuredThinkingResult,
  input: ThinkingInput,
): ThinkingResult {
  const id = `thinking_${Date.now().toString(36)}`;
  const wishId = `${id}_wish`;
  const storefront = toStorefrontThinkingResult({
    thinking: result,
    thinkingInput: buildStructuredThinkingInput(input),
  });
  const needsClarification =
    result.projectAction.shouldAskClarification ||
    result.downstream.recommendedNextStep === "ask_clarification";
  return {
    id,
    projectId: input.projectId,
    runId: input.runId,
    userFacingUnderstanding: result.normalizedTask.description,
    promptClassification: {
      lifecycleIntent: mapStructuredIntent(result.intent),
      confidence: result.confidence,
      reasonSummary: result.normalizedTask.title,
    },
    extractedWishes: [
      {
        id: wishId,
        type: "explicit",
        description: result.userWish.explicitRequests[0] ?? input.userPrompt,
        priority: "must_have",
        confidence: result.confidence,
        evidence: result.userWish.rawPrompt,
      },
    ],
    ecommerceInterpretation: {
      primaryGoal: mapConversionGoal(
        result.ecommerceContext.conversionGoal,
        result.intent,
      ),
      affectedPages: result.ecommerceContext.affectedPages,
      affectedSections: result.ecommerceContext.affectedSections,
      affectedFeatures: result.ecommerceContext.affectedFeatures,
      affectedDataModels: result.ecommerceContext.affectedEntities,
      expectedBusinessImpact:
        result.userWish.inferredEcommerceGoals[0] ??
        result.normalizedTask.description,
    },
    constraints: {
      explicitConstraints: result.userWish.outOfScopeRequests,
      inferredConstraints: [],
      doNotChange: [
        result.constraints.preserveExistingDesign
          ? "Preserve existing design."
          : "",
        result.constraints.preserveExistingFeatures
          ? "Preserve existing features."
          : "",
      ].filter(Boolean),
      styleConstraints: [],
      technicalConstraints: result.constraints.forbiddenActions,
    },
    assumptions: result.userWish.implicitRequests.map((description, index) => ({
      id: `${id}_assumption_${index}`,
      description,
      reason: "Inferred by Thinking Layer.",
      risk: "low",
    })),
    ambiguities: needsClarification
      ? [
          {
            id: `${id}_ambiguity`,
            question:
              result.projectAction.clarificationQuestion ??
              "Vui lòng xác nhận trước khi tiếp tục.",
            impact: result.risk.level,
            recommendedHandling: "ask_user",
          },
        ]
      : [],
    conflicts: [],
    riskAssessment: {
      level: result.risk.level,
      reasons: result.risk.reasons,
      requiresUserConfirmation: needsClarification,
    },
    suggestedAcceptanceCriteria:
      result.normalizedTask.acceptanceCriteria.length > 0
        ? result.normalizedTask.acceptanceCriteria
        : [result.normalizedTask.description],
    downstreamTask: {
      taskId: `${id}_task`,
      projectId: input.projectId,
      runId: input.runId,
      taskType: needsClarification
        ? "needs_clarification"
        : storefront.executionMode !== "apply"
          ? "answer_question"
        : mapTaskType(result.intent),
      normalizedGoal: result.normalizedTask.title,
      userPrompt: input.userPrompt,
      requirements: [
        {
          id: `${id}_req`,
          description: result.normalizedTask.description,
          sourceWishId: wishId,
          priority: "must_have",
          acceptanceCriteria:
            result.normalizedTask.acceptanceCriteria.length > 0
              ? result.normalizedTask.acceptanceCriteria
              : [result.normalizedTask.description],
        },
      ],
      targetScope: {
        pages: result.ecommerceContext.affectedPages,
        sections: result.ecommerceContext.affectedSections,
        features: result.ecommerceContext.affectedFeatures,
        filesHint: [],
        dataModels: result.ecommerceContext.affectedEntities,
      },
      executionPolicy: {
        allowInitSource:
          result.projectAction.requiresSourceInit && !needsClarification,
        allowPatchSource:
          result.projectAction.requiresPatchGeneration && !needsClarification,
        allowPackageChange: false,
        allowConfigChange: false,
        allowPreviewRestart:
          result.projectAction.requiresPreviewRefresh && !needsClarification,
        requireHumanConfirmation: needsClarification,
      },
      clarification: needsClarification
        ? {
            required: true,
            question:
              result.projectAction.clarificationQuestion ??
              "Vui lòng xác nhận trước khi tiếp tục.",
            reason: result.risk.reasons.join("; "),
          }
        : undefined,
      storefront: {
        executionMode: storefront.executionMode,
        actionPolicy: storefront.actionPolicy,
        acceptanceCriteria: storefront.acceptanceCriteria,
        implementationBias: storefront.implementationBias,
      },
    },
  };
}

function buildBlockedThinkingResult(
  input: ThinkingInput,
  reason: string,
): ThinkingResult {
  const id = `thinking_blocked_${Date.now().toString(36)}`;
  const wishId = `${id}_wish`;
  return {
    id,
    projectId: input.projectId,
    runId: input.runId,
    userFacingUnderstanding:
      "Mình không thể xử lý yêu cầu này vì nó có dấu hiệu không an toàn.",
    promptClassification: {
      lifecycleIntent: "unknown",
      confidence: 1,
      reasonSummary: reason,
    },
    extractedWishes: [
      {
        id: wishId,
        type: "explicit",
        description: "Unsafe or unsupported prompt",
        priority: "must_have",
        confidence: 1,
        evidence: "Prompt was blocked during preflight.",
      },
    ],
    ecommerceInterpretation: {
      primaryGoal: "technical_fix",
      affectedPages: [],
      affectedSections: [],
      affectedFeatures: [],
      affectedDataModels: [],
      expectedBusinessImpact:
        "No storefront changes are made for unsafe prompts.",
    },
    constraints: {
      explicitConstraints: [],
      inferredConstraints: [],
      doNotChange: ["Do not mutate source."],
      styleConstraints: [],
      technicalConstraints: [reason],
    },
    assumptions: [],
    ambiguities: [],
    conflicts: [
      {
        id: `${id}_conflict`,
        description: reason,
        conflictWith: "security_policy",
        severity: "high",
        resolution: "block",
      },
    ],
    riskAssessment: {
      level: "high",
      reasons: [reason],
      requiresUserConfirmation: true,
    },
    suggestedAcceptanceCriteria: ["No source mutation occurs."],
    downstreamTask: {
      taskId: `${id}_task`,
      projectId: input.projectId,
      runId: input.runId,
      taskType: "needs_clarification",
      normalizedGoal: "Block unsafe prompt before planning.",
      userPrompt: input.userPrompt || "[blocked]",
      requirements: [
        {
          id: `${id}_req`,
          description: "Stop unsafe prompt before planning.",
          sourceWishId: wishId,
          priority: "must_have",
          acceptanceCriteria: ["No downstream source workflow runs."],
        },
      ],
      targetScope: {
        pages: [],
        sections: [],
        features: [],
        filesHint: [],
        dataModels: [],
      },
      executionPolicy: {
        allowInitSource: false,
        allowPatchSource: false,
        allowPackageChange: false,
        allowConfigChange: false,
        allowPreviewRestart: false,
        requireHumanConfirmation: true,
      },
      clarification: {
        required: true,
        question:
          "Vui lòng gửi lại yêu cầu chỉnh website mà không yêu cầu bỏ qua chính sách hoặc lộ reasoning nội bộ.",
        reason,
      },
    },
  };
}

function compactProjectState(projectState: ThinkingInput["projectState"]) {
  if (!projectState) return null;
  return {
    status: projectState.status,
    brand: projectState.brand,
    ecommerceSpec: projectState.ecommerceSpec,
    features: projectState.features,
    constraints: projectState.constraints,
    pages: projectState.pages,
    fileManifest: projectState.fileManifest,
  };
}

function mapStructuredIntent(
  intent: StructuredThinkingResult["intent"],
): ThinkingResult["promptClassification"]["lifecycleIntent"] {
  if (intent === "integrate_service") return "add_feature";
  return intent;
}

function mapTaskType(
  intent: StructuredThinkingResult["intent"],
): ThinkingResult["downstreamTask"]["taskType"] {
  if (intent === "init_project") return "init_storefront_project";
  if (intent === "modify_design") return "design_update";
  if (intent === "modify_content") return "content_update";
  if (intent === "modify_products") return "product_data_update";
  if (intent === "fix_bug") return "bug_fix";
  if (intent === "explain_project") return "answer_question";
  return "incremental_source_update";
}

function mapConversionGoal(
  goal: StructuredThinkingResult["ecommerceContext"]["conversionGoal"],
  intent: StructuredThinkingResult["intent"],
): ThinkingResult["ecommerceInterpretation"]["primaryGoal"] {
  if (intent === "init_project") return "project_initialization";
  if (intent === "modify_content") return "content_update";
  if (intent === "fix_bug") return "technical_fix";
  if (goal === "improve_product_discovery") return "product_discovery";
  if (goal === "increase_trust") return "trust_building";
  if (goal === "improve_brand_perception") return "brand_positioning";
  if (goal === "increase_checkout_completion") return "checkout_improvement";
  return "conversion";
}

function mapProjectStatus(
  status: ProjectState["status"] | undefined,
): ThinkingInput["projectContext"]["status"] {
  if (!status || status === "empty") return "empty";
  if (status === "initialized") return "initialized";
  if (status === "initializing" || status === "updating") return "building";
  if (status === "failed") return "error";
  return "ready";
}

function mapFileKind(
  kind: ProjectState["fileManifest"][number]["kind"],
): ThinkingInput["projectContext"]["fileManifest"][number]["kind"] {
  if (
    kind === "route" ||
    kind === "component" ||
    kind === "style" ||
    kind === "config" ||
    kind === "data"
  )
    return kind;
  if (kind === "store") return "state";
  if (kind === "api") return "server";
  return "unknown";
}
