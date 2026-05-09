import type { AgentConfig } from "../agent/agent-config";
import type { AgentRun, ProjectState } from "../project/project-state.schema";
import { validateThinkingBusinessRules } from "./thinking-business-validator";
import { THINKING_LAYER_CONFIG } from "./thinking-config";
import { createClarificationStructuredThinkingResult, createHeuristicThinkingResult } from "./thinking-fallback";
import { ThinkingResultJsonSchema } from "./thinking-json-schema";
import { preflightUserPrompt } from "./thinking-preflight";
import { THINKING_LAYER_DEVELOPER_PROMPT, THINKING_LAYER_SYSTEM_PROMPT } from "./thinking.prompt";
import { structuredThinkingResultSchema, thinkingInputSchema, thinkingResultSchema, type StructuredThinkingInput, type StructuredThinkingResult, type ThinkingInput, type ThinkingResult } from "./thinking.schema";

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

export async function runThinkingLayer(input: RunThinkingLayerInput): Promise<ThinkingResult> {
  const maxPromptChars = input.agentConfig?.maxPromptChars ?? 12_000;
  const preflight = preflightUserPrompt(input.userPrompt, maxPromptChars);
  const thinkingInput = buildThinkingInput({ ...input, userPrompt: preflight.sanitizedPrompt || input.userPrompt });

  if (preflight.blocked) {
    const blocked = buildBlockedThinkingResult(thinkingInput, preflight.blockReason ?? "The prompt cannot be processed safely.");
    await input.saveResult?.(blocked);
    return blocked;
  }

  const result = input.provider
    ? await extractProviderThinkingResult(input.provider, thinkingInput, input.agentConfig?.plannerModel ?? THINKING_LAYER_CONFIG.model)
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
    const structured = await requestValidatedStructuredThinkingResult({ provider, model, thinkingInput: structuredInput });
    return thinkingResultSchema.parse(structuredThinkingToLegacyResult(structured, thinkingInput));
  } catch (error) {
    console.warn(JSON.stringify({
      event: "thinking_provider_fallback",
      projectId: thinkingInput.projectId,
      runId: thinkingInput.runId,
      error: error instanceof Error ? error.message : "Unknown thinking provider error.",
    }));
    const fallback = createClarificationStructuredThinkingResult(structuredInput, error instanceof Error ? error.message : "Thinking provider validation failed.");
    return thinkingResultSchema.parse(structuredThinkingToLegacyResult(fallback, thinkingInput));
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
    hasInitializedSource: input.thinkingInput.runtimeContext.hasInitializedSource,
  });
  if (firstValidation.ok) return first;

  const repaired = await requestStructuredThinkingResult({
    ...input,
    repairInstruction: firstValidation.errors.join("; "),
  });
  const repairedValidation = validateThinkingBusinessRules({
    result: repaired,
    hasInitializedSource: input.thinkingInput.runtimeContext.hasInitializedSource,
  });
  if (repairedValidation.ok) return repaired;

  throw new Error(`Thinking Result failed business validation: ${repairedValidation.errors.join("; ")}`);
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
  return structuredThinkingResultSchema.parse(result);
}

function buildStructuredThinkingSystemPrompt(repairInstruction?: string) {
  const basePrompt = `${THINKING_LAYER_SYSTEM_PROMPT}\n\n${THINKING_LAYER_DEVELOPER_PROMPT}`;
  if (!repairInstruction) return basePrompt;
  return `${basePrompt}\n\nRepair the previous ThinkingResult. Keep the same user intent, fix only these validation errors, and return a complete root ThinkingResult object: ${repairInstruction}`;
}

function buildThinkingInput(input: RunThinkingLayerInput): ThinkingInput {
  return thinkingInputSchema.parse({
    projectId: input.projectId,
    runId: input.run.id,
    userId: input.userId,
    userPrompt: input.userPrompt.trim(),
    projectState: input.projectState,
    conversationContext: { recentUserMessages: [], recentAssistantSummaries: [] },
    projectContext: {
      status: mapProjectStatus(input.projectState?.status),
      fileManifest: (input.projectState?.fileManifest ?? []).map((file) => ({ path: file.path, purpose: file.purpose, kind: mapFileKind(file.kind) })),
      recentChanges: (input.projectState?.recentChanges ?? []).slice(0, 5).map((change) => ({
        runId: change.runId,
        userPrompt: change.userPrompt,
        summary: change.summary,
        changedFiles: change.changedFiles,
        validationStatus: change.validationStatus,
      })),
    },
  });
}

export function buildStructuredThinkingInput(input: ThinkingInput): StructuredThinkingInput {
  return {
    projectId: input.projectId,
    userId: input.userId ?? "anonymous",
    userPrompt: input.userPrompt,
    projectState: compactProjectState(input.projectState) as ProjectState | null,
    recentConversationSummary: input.conversationContext.recentAssistantSummaries.at(-1)?.summary ?? null,
    recentUserMessages: input.conversationContext.recentUserMessages,
    runtimeContext: {
      hasInitializedSource: input.projectContext.status !== "empty" && input.projectContext.fileManifest.length > 0,
      hasRunningPreview: input.projectContext.previewStatus?.status === "running",
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

function structuredThinkingToLegacyResult(result: StructuredThinkingResult, input: ThinkingInput): ThinkingResult {
  const id = `thinking_${Date.now().toString(36)}`;
  const wishId = `${id}_wish`;
  const needsClarification = result.projectAction.shouldAskClarification || result.downstream.recommendedNextStep === "ask_clarification";
  return {
    id,
    projectId: input.projectId,
    runId: input.runId,
    userFacingUnderstanding: result.normalizedTask.description,
    promptClassification: { lifecycleIntent: mapStructuredIntent(result.intent), confidence: result.confidence, reasonSummary: result.normalizedTask.title },
    extractedWishes: [{ id: wishId, type: "explicit", description: result.userWish.explicitRequests[0] ?? input.userPrompt, priority: "must_have", confidence: result.confidence, evidence: result.userWish.rawPrompt }],
    ecommerceInterpretation: {
      primaryGoal: mapConversionGoal(result.ecommerceContext.conversionGoal, result.intent),
      affectedPages: result.ecommerceContext.affectedPages,
      affectedSections: result.ecommerceContext.affectedSections,
      affectedFeatures: result.ecommerceContext.affectedFeatures,
      affectedDataModels: result.ecommerceContext.affectedEntities,
      expectedBusinessImpact: result.userWish.inferredEcommerceGoals[0] ?? result.normalizedTask.description,
    },
    constraints: {
      explicitConstraints: result.userWish.outOfScopeRequests,
      inferredConstraints: [],
      doNotChange: [result.constraints.preserveExistingDesign ? "Preserve existing design." : "", result.constraints.preserveExistingFeatures ? "Preserve existing features." : ""].filter(Boolean),
      styleConstraints: [],
      technicalConstraints: result.constraints.forbiddenActions,
    },
    assumptions: result.userWish.implicitRequests.map((description, index) => ({ id: `${id}_assumption_${index}`, description, reason: "Inferred by Thinking Layer.", risk: "low" })),
    ambiguities: needsClarification ? [{ id: `${id}_ambiguity`, question: result.projectAction.clarificationQuestion ?? "Vui lòng xác nhận trước khi tiếp tục.", impact: result.risk.level, recommendedHandling: "ask_user" }] : [],
    conflicts: [],
    riskAssessment: { level: result.risk.level, reasons: result.risk.reasons, requiresUserConfirmation: needsClarification },
    suggestedAcceptanceCriteria: result.normalizedTask.acceptanceCriteria.length > 0 ? result.normalizedTask.acceptanceCriteria : [result.normalizedTask.description],
    downstreamTask: {
      taskId: `${id}_task`,
      projectId: input.projectId,
      runId: input.runId,
      taskType: needsClarification ? "needs_clarification" : mapTaskType(result.intent),
      normalizedGoal: result.normalizedTask.title,
      userPrompt: input.userPrompt,
      requirements: [{ id: `${id}_req`, description: result.normalizedTask.description, sourceWishId: wishId, priority: "must_have", acceptanceCriteria: result.normalizedTask.acceptanceCriteria.length > 0 ? result.normalizedTask.acceptanceCriteria : [result.normalizedTask.description] }],
      targetScope: { pages: result.ecommerceContext.affectedPages, sections: result.ecommerceContext.affectedSections, features: result.ecommerceContext.affectedFeatures, filesHint: [], dataModels: result.ecommerceContext.affectedEntities },
      executionPolicy: { allowInitSource: result.projectAction.requiresSourceInit && !needsClarification, allowPatchSource: result.projectAction.requiresPatchGeneration && !needsClarification, allowPackageChange: false, allowConfigChange: false, allowPreviewRestart: result.projectAction.requiresPreviewRefresh && !needsClarification, requireHumanConfirmation: needsClarification },
      clarification: needsClarification ? { required: true, question: result.projectAction.clarificationQuestion ?? "Vui lòng xác nhận trước khi tiếp tục.", reason: result.risk.reasons.join("; ") } : undefined,
    },
  };
}

function buildBlockedThinkingResult(input: ThinkingInput, reason: string): ThinkingResult {
  const id = `thinking_blocked_${Date.now().toString(36)}`;
  const wishId = `${id}_wish`;
  return {
    id,
    projectId: input.projectId,
    runId: input.runId,
    userFacingUnderstanding: "Mình không thể xử lý yêu cầu này vì nó có dấu hiệu không an toàn.",
    promptClassification: { lifecycleIntent: "unknown", confidence: 1, reasonSummary: reason },
    extractedWishes: [{ id: wishId, type: "explicit", description: "Unsafe or unsupported prompt", priority: "must_have", confidence: 1, evidence: "Prompt was blocked during preflight." }],
    ecommerceInterpretation: { primaryGoal: "technical_fix", affectedPages: [], affectedSections: [], affectedFeatures: [], affectedDataModels: [], expectedBusinessImpact: "No storefront changes are made for unsafe prompts." },
    constraints: { explicitConstraints: [], inferredConstraints: [], doNotChange: ["Do not mutate source."], styleConstraints: [], technicalConstraints: [reason] },
    assumptions: [],
    ambiguities: [],
    conflicts: [{ id: `${id}_conflict`, description: reason, conflictWith: "security_policy", severity: "high", resolution: "block" }],
    riskAssessment: { level: "high", reasons: [reason], requiresUserConfirmation: true },
    suggestedAcceptanceCriteria: ["No source mutation occurs."],
    downstreamTask: {
      taskId: `${id}_task`,
      projectId: input.projectId,
      runId: input.runId,
      taskType: "needs_clarification",
      normalizedGoal: "Block unsafe prompt before planning.",
      userPrompt: input.userPrompt || "[blocked]",
      requirements: [{ id: `${id}_req`, description: "Stop unsafe prompt before planning.", sourceWishId: wishId, priority: "must_have", acceptanceCriteria: ["No downstream source workflow runs."] }],
      targetScope: { pages: [], sections: [], features: [], filesHint: [], dataModels: [] },
      executionPolicy: { allowInitSource: false, allowPatchSource: false, allowPackageChange: false, allowConfigChange: false, allowPreviewRestart: false, requireHumanConfirmation: true },
      clarification: { required: true, question: "Vui lòng gửi lại yêu cầu chỉnh website mà không yêu cầu bỏ qua chính sách hoặc lộ reasoning nội bộ.", reason },
    },
  };
}

function compactProjectState(projectState: ThinkingInput["projectState"]) {
  if (!projectState) return null;
  return { status: projectState.status, brand: projectState.brand, ecommerceSpec: projectState.ecommerceSpec, features: projectState.features, constraints: projectState.constraints, pages: projectState.pages };
}

function mapStructuredIntent(intent: StructuredThinkingResult["intent"]): ThinkingResult["promptClassification"]["lifecycleIntent"] {
  if (intent === "integrate_service") return "add_feature";
  return intent;
}

function mapTaskType(intent: StructuredThinkingResult["intent"]): ThinkingResult["downstreamTask"]["taskType"] {
  if (intent === "init_project") return "init_storefront_project";
  if (intent === "modify_design") return "design_update";
  if (intent === "modify_content") return "content_update";
  if (intent === "modify_products") return "product_data_update";
  if (intent === "fix_bug") return "bug_fix";
  if (intent === "explain_project") return "answer_question";
  return "incremental_source_update";
}

function mapConversionGoal(goal: StructuredThinkingResult["ecommerceContext"]["conversionGoal"], intent: StructuredThinkingResult["intent"]): ThinkingResult["ecommerceInterpretation"]["primaryGoal"] {
  if (intent === "init_project") return "project_initialization";
  if (intent === "modify_content") return "content_update";
  if (intent === "fix_bug") return "technical_fix";
  if (goal === "improve_product_discovery") return "product_discovery";
  if (goal === "increase_trust") return "trust_building";
  if (goal === "improve_brand_perception") return "brand_positioning";
  if (goal === "increase_checkout_completion") return "checkout_improvement";
  return "conversion";
}

function mapProjectStatus(status: ProjectState["status"] | undefined): ThinkingInput["projectContext"]["status"] {
  if (!status || status === "empty") return "empty";
  if (status === "initialized") return "initialized";
  if (status === "initializing" || status === "updating") return "building";
  if (status === "failed") return "error";
  return "ready";
}

function mapFileKind(kind: ProjectState["fileManifest"][number]["kind"]): ThinkingInput["projectContext"]["fileManifest"][number]["kind"] {
  if (kind === "route" || kind === "component" || kind === "style" || kind === "config" || kind === "data") return kind;
  if (kind === "store") return "state";
  if (kind === "api") return "server";
  return "unknown";
}
