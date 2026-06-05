import type { AgentConfig } from "../agent/agent-config";
import type { ChatCompletionsProvider } from "../openai/chat-completions-provider.server";
import type { AgentRun, ProjectState } from "../project/project-state.schema";
import {
  createClarificationStructuredThinkingResult,
  createDefaultClarificationOptions,
  createHeuristicThinkingResult,
} from "./thinking-fallback";
import { preflightUserPrompt } from "./thinking-preflight";
import { extractUserWishes } from "./user-wish-extractor.server";
import { isProtectedProjectEnvPath } from "../code-tools/services/project-path-guard.server";
import {
  thinkingInputSchema,
  thinkingResultSchema,
  type StructuredThinkingInput,
  type StructuredThinkingResult,
  type ThinkingInput,
  type ThinkingResult,
} from "./thinking.schema";
import {
  detectHardClarificationBlock,
} from "./storefront-prompt-policy";

export type RunThinkingLayerInput = {
  projectId: string;
  run: AgentRun;
  userId?: string;
  userPrompt: string;
  projectState: ProjectState | null;
  provider?: ChatCompletionsProvider;
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

  const hasInitializedSource =
    thinkingInput.projectContext.status !== "empty" &&
    thinkingInput.projectContext.fileManifest.length > 0;

  const hardBlock = detectHardClarificationBlock({
    userPrompt: thinkingInput.userPrompt,
    projectState: thinkingInput.projectState,
    hasInitializedSource,
  });

  if (hardBlock) {
    const structuredInput = buildStructuredThinkingInput(thinkingInput);
    const clarification = createClarificationStructuredThinkingResult(
      structuredInput,
      hardBlock.reason,
    );
    const result = thinkingResultSchema.parse(
      structuredThinkingToLegacyResult(clarification, thinkingInput),
    );
    await input.saveResult?.(result);
    return result;
  }

  const result = await runLLMThinkingWithFallback({
    thinkingInput,
    provider: input.provider,
    model: input.agentConfig?.plannerModel,
  });
  const validated = thinkingResultSchema.parse(result);
  await input.saveResult?.(validated);
  return validated;
}

async function runLLMThinkingWithFallback(args: {
  thinkingInput: ThinkingInput;
  provider?: ChatCompletionsProvider;
  model?: string;
}): Promise<ThinkingResult> {
  if (!args.provider || !args.model) {
    return createHeuristicThinkingResult(args.thinkingInput);
  }
  const startedAt = Date.now();
  try {
    const structured = await extractUserWishes({
      input: args.thinkingInput,
      provider: args.provider,
      model: args.model,
    });
    const legacy = structuredThinkingToLegacyResult(structured, args.thinkingInput);
    const validated = thinkingResultSchema.parse(legacy);
    console.info(JSON.stringify({
      event: "thinking_layer_llm_completed",
      projectId: args.thinkingInput.projectId,
      runId: args.thinkingInput.runId,
      model: args.model,
      durationMs: Date.now() - startedAt,
      intent: validated.promptClassification.lifecycleIntent,
      riskLevel: validated.riskAssessment.level,
    }));
    return validated;
  } catch (error) {
    console.warn(JSON.stringify({
      event: "thinking_layer_llm_failed_falling_back_to_heuristic",
      projectId: args.thinkingInput.projectId,
      runId: args.thinkingInput.runId,
      model: args.model,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    }));
    return createHeuristicThinkingResult(args.thinkingInput);
  }
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
  const needsClarification =
    result.projectAction.shouldAskClarification ||
    result.downstream.recommendedNextStep === "ask_clarification";
  const fallbackWishDescription =
    pickNonEmpty(result.userWish.explicitRequests[0], input.userPrompt, result.normalizedTask.title) ??
    "Process the user prompt.";
  const acceptanceCriteria = filterNonEmpty(result.normalizedTask.acceptanceCriteria);
  const clarificationOptions = result.projectAction.clarificationOptions;
  const safeAcceptanceCriteria = acceptanceCriteria.length > 0
    ? acceptanceCriteria
    : [result.normalizedTask.description];
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
        description: fallbackWishDescription,
        priority: "must_have",
        confidence: result.confidence,
        evidence: pickNonEmpty(result.userWish.rawPrompt, input.userPrompt) ?? fallbackWishDescription,
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
              "Please confirm before continuing.",
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
    suggestedAcceptanceCriteria: safeAcceptanceCriteria,
    downstreamTask: {
      taskId: `${id}_task`,
      projectId: input.projectId,
      runId: input.runId,
      taskType: needsClarification
        ? "needs_clarification"
        : mapTaskType(result.intent),
      normalizedGoal: result.normalizedTask.title,
      userPrompt: input.userPrompt,
      requirements: [
        {
          id: `${id}_req`,
          description: result.normalizedTask.description,
          sourceWishId: wishId,
          priority: "must_have",
          acceptanceCriteria: safeAcceptanceCriteria,
        },
      ],
      targetScope: {
        pages: result.ecommerceContext.affectedPages,
        sections: result.ecommerceContext.affectedSections,
        features: result.ecommerceContext.affectedFeatures,
        filesHint: inferLikelyFilesFromScope({
          pages: result.ecommerceContext.affectedPages,
          sections: result.ecommerceContext.affectedSections,
          features: result.ecommerceContext.affectedFeatures,
          prompt: input.userPrompt,
        }),
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
              "Please confirm before continuing.",
            reason: result.risk.reasons.join("; "),
            options: clarificationOptions,
          }
        : undefined,
      storefront: {
        executionMode: needsClarification ? "plan" : "apply",
        actionPolicy: {
          shouldApplyCode: !needsClarification,
          shouldCreatePlanOnly: needsClarification,
          shouldAskClarification: needsClarification,
          clarificationQuestion: needsClarification
            ? (result.projectAction.clarificationQuestion ?? null)
            : null,
          clarificationReason: needsClarification
            ? result.risk.reasons.join("; ")
            : null,
          clarificationOptions: needsClarification ? clarificationOptions : [],
        },
        acceptanceCriteria: safeAcceptanceCriteria,
        implementationBias: {
          preferMinimalPatch: true,
          preserveExistingDesignDirection: true,
          useExistingComponentsFirst: true,
          avoidFullRewrite: true,
        },
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
      "Cannot process this request due to safety concerns.",
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
          "Please resubmit your request without bypassing security policies.",
        reason,
        options: createDefaultClarificationOptions(),
      },
    },
  };
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
      fileManifest: (input.projectState?.fileManifest ?? []).filter((file) => !isProtectedProjectEnvPath(file.path)).map((file) => ({
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

function compactProjectState(projectState: ThinkingInput["projectState"]) {
  if (!projectState) return null;
  return {
    status: projectState.status,
    brand: projectState.brand,
    ecommerceSpec: projectState.ecommerceSpec,
    features: projectState.features,
    constraints: projectState.constraints,
    pages: projectState.pages,
    fileManifest: projectState.fileManifest.filter((file) => !isProtectedProjectEnvPath(file.path)),
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

function inferLikelyFilesFromScope(input: {
  pages: readonly string[];
  sections: readonly string[];
  features: readonly string[];
  prompt: string;
}): string[] {
  const normalized = [
    input.prompt,
    ...input.pages,
    ...input.sections,
    ...input.features,
  ]
    .join(" ")
    .toLocaleLowerCase();
  const files = new Set<string>();

  if (
    input.pages.some((page) => page.trim() === "/") ||
    includesAny(normalized, ["home", "homepage", "trang chủ", "hero", "banner"])
  ) {
    files.add("src/routes/index.tsx");
    files.add("src/components/store/*");
  }
  if (includesAny(normalized, ["products", "product listing", "catalog", "sản phẩm", "/products"])) {
    files.add("src/routes/products/index.tsx");
    files.add("src/components/store/product-grid.tsx");
    files.add("src/components/store/product-card.tsx");
  }
  if (includesAny(normalized, ["product detail", "chi tiết sản phẩm", "$productid"])) {
    files.add("src/routes/products/$productId.tsx");
  }
  if (includesAny(normalized, ["cart", "giỏ hàng"])) {
    files.add("src/routes/cart.tsx");
    files.add("src/app/cart-provider.tsx");
  }
  if (includesAny(normalized, ["checkout", "thanh toán"])) {
    files.add("src/routes/checkout.tsx");
  }
  if (includesAny(normalized, ["order", "orders", "đơn hàng"])) {
    files.add("src/routes/orders/index.tsx");
    files.add("src/routes/orders/$orderId.tsx");
  }
  if (includesAny(normalized, ["header", "navigation", "nav", "menu"])) {
    files.add("src/components/layout/site-header.tsx");
  }
  if (includesAny(normalized, ["footer"])) {
    files.add("src/components/layout/site-footer.tsx");
  }
  if (includesAny(normalized, ["style", "theme", "đẹp", "xịn", "premium", "css"])) {
    files.add("DESIGN.md");
    files.add("src/styles/app.css");
  }

  if (files.size === 0) {
    files.add("src/routes/index.tsx");
    files.add("src/components/store/*");
  }
  return [...files];
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

function pickNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return undefined;
}

function filterNonEmpty(values: ReadonlyArray<string | undefined | null>): string[] {
  const result: string[] = [];
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) result.push(value);
  }
  return result;
}

function includesAny(value: string, needles: readonly string[]) {
  return needles.some((needle) => value.includes(needle));
}
