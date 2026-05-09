import type { AgentConfig } from "../agent/agent-config";
import type { AgentRun, ProjectState } from "../project/project-state.schema";
import { THINKING_LAYER_DEVELOPER_PROMPT, THINKING_LAYER_SYSTEM_PROMPT } from "./thinking.prompt";
import { createHeuristicThinkingResult } from "./thinking-fallback";
import { preflightUserPrompt } from "./thinking-preflight";
import { thinkingInputSchema, thinkingResultProviderSchema, thinkingResultSchema, type ThinkingInput, type ThinkingResult } from "./thinking.schema";

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
    ? await extractProviderThinkingResult(input.provider, thinkingInput, input.agentConfig?.plannerModel ?? "gpt-5.4-mini")
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
  try {
    const result = await provider.parseStructured<unknown, unknown>({
      model,
      system: `${THINKING_LAYER_SYSTEM_PROMPT}

${THINKING_LAYER_DEVELOPER_PROMPT}`,
      user: {
        userPrompt: thinkingInput.userPrompt,
        projectState: compactProjectState(thinkingInput.projectState),
        projectContext: thinkingInput.projectContext,
        conversationContext: thinkingInput.conversationContext,
      },
      schemaName: "thinking_result",
      schema: thinkingResultProviderSchema,
    });
    return thinkingResultSchema.parse(result);
  } catch (error) {
    console.warn(JSON.stringify({
      event: "thinking_provider_fallback",
      projectId: thinkingInput.projectId,
      runId: thinkingInput.runId,
      error: error instanceof Error ? error.message : "Unknown thinking provider error.",
    }));
    return createHeuristicThinkingResult(thinkingInput);
  }
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
