import type {
  StructuredThinkingInput,
  StructuredThinkingResult,
  StorefrontThinkingResult,
} from "./thinking.schema";
import {
  detectHardClarificationBlock,
  inferExecutionModeFromPrompt,
  inferStorefrontAreas,
  inferStorefrontIntent,
  isLikelyStorefrontPrompt,
} from "./storefront-prompt-policy";
import { createDefaultClarificationOptions } from "./thinking-fallback";

export function normalizeStructuredThinkingForProjectDetail(input: {
  thinking: StructuredThinkingResult;
  thinkingInput: StructuredThinkingInput;
}): StructuredThinkingResult {
  const { thinking, thinkingInput } = input;
  const block = detectHardClarificationBlock({
    userPrompt: thinkingInput.userPrompt,
    projectState: thinkingInput.projectState,
    hasInitializedSource: thinkingInput.runtimeContext.hasInitializedSource,
  });

  if (block)
    return applyClarificationBlock(thinking, block.reason, block.question);

  const mode = inferExecutionModeFromPrompt(thinkingInput.userPrompt);
  const normalized = structuredCloneThinking(thinking);

  if (mode === "apply") {
    normalized.intent = mapStorefrontIntentToStructuredIntent(
      inferStorefrontIntent(thinkingInput.userPrompt, normalized.intent),
    );
    normalized.projectAction.shouldAskClarification = false;
    normalized.projectAction.clarificationQuestion = null;
    normalized.projectAction.clarificationOptions = [];
    normalized.projectAction.shouldInitProject = false;
    normalized.projectAction.shouldModifyExistingProject = true;
    normalized.projectAction.requiresSourceInit = false;
    normalized.projectAction.requiresPatchGeneration = true;
    normalized.projectAction.requiresValidation = true;
    normalized.projectAction.requiresPreviewRefresh = true;
    normalized.downstream.recommendedNextStep = "generate_patch";
    normalized.constraints.preserveExistingDesign = true;
    normalized.constraints.preserveExistingFeatures = true;
    normalized.constraints.requestedDestructiveChange = false;
    normalized.risk.level =
      normalized.risk.level === "high" ? "medium" : normalized.risk.level;
    normalized.risk.reasons = normalized.risk.reasons.filter(
      (reason) => !/clarification|low-confidence|low confidence/i.test(reason),
    );
    normalized.ecommerceContext.affectedSections = mergeUnique(
      normalized.ecommerceContext.affectedSections,
      inferStorefrontAreas(thinkingInput.userPrompt),
    );
    normalized.normalizedTask.acceptanceCriteria = ensureAcceptanceCriteria(
      normalized,
      thinkingInput.userPrompt,
    );
    normalized.normalizedTask.description =
      normalized.normalizedTask.description ||
      createSafeApplySummary(thinkingInput.userPrompt);
    normalized.normalizedTask.title =
      normalized.normalizedTask.title || "Apply storefront improvement";
    return normalized;
  }

  normalized.projectAction.shouldAskClarification = false;
  normalized.projectAction.clarificationQuestion = null;
  normalized.projectAction.clarificationOptions = [];
  normalized.projectAction.shouldInitProject = false;
  normalized.projectAction.shouldModifyExistingProject = false;
  normalized.projectAction.requiresSourceInit = false;
  normalized.projectAction.requiresPatchGeneration = false;
  normalized.projectAction.requiresValidation = false;
  normalized.projectAction.requiresPreviewRefresh = false;
  normalized.downstream.recommendedNextStep =
    mode === "explain" ? "explain_only" : "create_plan";
  normalized.normalizedTask.acceptanceCriteria = ensureAcceptanceCriteria(
    normalized,
    thinkingInput.userPrompt,
  );
  return normalized;
}

export function createDefaultAcceptanceCriteria(input: {
  intent: StructuredThinkingResult["intent"];
  userPrompt: string;
  affectedSections?: string[];
}): string[] {
  const areas = input.affectedSections?.length
    ? input.affectedSections.join(", ")
    : "relevant storefront sections";
  return [
    `Current storefront code is inspected before changing ${areas}.`,
    "The update uses a minimal patch and preserves existing storefront behavior unless explicitly requested otherwise.",
    "The storefront change is validated after mutation or reports a specific validation blocker.",
  ];
}

export function toStorefrontThinkingResult(input: {
  thinking: StructuredThinkingResult;
  thinkingInput: StructuredThinkingInput;
}): StorefrontThinkingResult {
  const mode = inferExecutionModeFromPrompt(input.thinkingInput.userPrompt);
  const block = detectHardClarificationBlock({
    userPrompt: input.thinkingInput.userPrompt,
    projectState: input.thinkingInput.projectState,
    hasInitializedSource:
      input.thinkingInput.runtimeContext.hasInitializedSource,
  });
  const intent = inferStorefrontIntent(
    input.thinkingInput.userPrompt,
    input.thinking.intent,
  );
  const areas = inferStorefrontAreas(input.thinkingInput.userPrompt);
  const shouldApply = !block && mode === "apply";
  return {
    executionMode: block ? "apply" : mode,
    intent,
    confidence: isLikelyStorefrontPrompt(input.thinkingInput.userPrompt)
      ? Math.max(input.thinking.confidence, 0.55)
      : input.thinking.confidence,
    userWish: {
      rawPrompt: input.thinkingInput.userPrompt,
      normalizedWish:
        input.thinking.normalizedTask.description ||
        createSafeApplySummary(input.thinkingInput.userPrompt),
      explicitRequests: input.thinking.userWish.explicitRequests.length
        ? input.thinking.userWish.explicitRequests
        : [input.thinkingInput.userPrompt],
      inferredRequests: input.thinking.userWish.implicitRequests,
      ecommerceGoal:
        input.thinking.userWish.inferredEcommerceGoals[0] ??
        "Improve the current e-commerce storefront.",
    },
    target: {
      projectScope: "current_project",
      storefrontArea: areas,
      likelyFilesOrFolders: inferLikelyFiles(areas),
      requiresCodeInspection: shouldApply,
    },
    actionPolicy: {
      shouldApplyCode: shouldApply,
      shouldCreatePlanOnly: !block && mode === "plan",
      shouldAskClarification: Boolean(block),
      clarificationQuestion: block?.question ?? null,
      clarificationReason: block?.reason ?? null,
      clarificationOptions: block ? createDefaultClarificationOptions() : [],
    },
    implementationBias: {
      preferMinimalPatch: true,
      preserveExistingDesignDirection: true,
      useExistingComponentsFirst: true,
      avoidFullRewrite: true,
    },
    acceptanceCriteria: ensureAcceptanceCriteria(
      input.thinking,
      input.thinkingInput.userPrompt,
    ),
    safeUserFacingSummary: block
      ? block.question
      : createSafeApplySummary(input.thinkingInput.userPrompt),
  };
}

function applyClarificationBlock(
  result: StructuredThinkingResult,
  reason: string,
  question: string,
): StructuredThinkingResult {
  const normalized = structuredCloneThinking(result);
  normalized.projectAction.shouldAskClarification = true;
  normalized.projectAction.clarificationQuestion = question;
  normalized.projectAction.clarificationOptions = createDefaultClarificationOptions();
  normalized.projectAction.shouldModifyExistingProject = false;
  normalized.projectAction.requiresPatchGeneration = false;
  normalized.projectAction.requiresValidation = false;
  normalized.projectAction.requiresPreviewRefresh = false;
  normalized.downstream.recommendedNextStep = "ask_clarification";
  normalized.risk.level = "high";
  normalized.risk.reasons = mergeUnique(normalized.risk.reasons, [reason]);
  normalized.normalizedTask.title = "Clarify storefront request";
  normalized.normalizedTask.description = question;
  normalized.normalizedTask.acceptanceCriteria = [
    "No project files are mutated until the blocker is resolved.",
  ];
  return normalized;
}

function ensureAcceptanceCriteria(
  result: StructuredThinkingResult,
  userPrompt: string,
): string[] {
  return result.normalizedTask.acceptanceCriteria.length > 0
    ? result.normalizedTask.acceptanceCriteria
    : createDefaultAcceptanceCriteria({
        intent: result.intent,
        userPrompt,
        affectedSections: result.ecommerceContext.affectedSections,
      });
}

function createSafeApplySummary(prompt: string): string {
  return `I will apply storefront changes based on your request: ${prompt.replace(/[.!?。]+$/, "")}.`;
}

function inferLikelyFiles(areas: string[]): string[] {
  const files = new Set<string>(["src/routes", "src/components"]);
  if (areas.includes("product_listing") || areas.includes("product_card"))
    files
      .add("src/components/ProductCard.tsx")
      .add("src/components/ProductGrid.tsx");
  if (areas.includes("checkout")) files.add("src/routes/checkout.tsx");
  if (areas.includes("cart")) files.add("src/components/Cart.tsx");
  if (areas.includes("filter")) files.add("src/components/ProductFilters.tsx");
  return [...files];
}

function mapStorefrontIntentToStructuredIntent(
  intent: ReturnType<typeof inferStorefrontIntent>,
): StructuredThinkingResult["intent"] {
  if (
    intent === "improve_responsive" ||
    intent === "improve_conversion" ||
    intent === "unknown_storefront_change"
  )
    return "modify_design";
  if (intent === "remove_feature") return "modify_content";
  return intent;
}

function mergeUnique<T>(left: T[], right: T[]): T[] {
  return [...new Set([...left, ...right])];
}

function structuredCloneThinking(
  result: StructuredThinkingResult,
): StructuredThinkingResult {
  return JSON.parse(JSON.stringify(result)) as StructuredThinkingResult;
}
