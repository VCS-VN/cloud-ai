import { describe, expect, it } from "vitest";
import { validateThinkingBusinessRules } from "./thinking-business-validator";
import type { StructuredThinkingResult } from "./thinking.schema";

function baseResult(overrides: Partial<StructuredThinkingResult> = {}): StructuredThinkingResult {
  return {
    intent: "modify_content",
    confidence: 0.9,
    language: "vi",
    userWish: {
      rawPrompt: "Thêm banner khuyến mãi",
      explicitRequests: ["Thêm banner khuyến mãi"],
      implicitRequests: [],
      inferredEcommerceGoals: ["increase_trust"],
      outOfScopeRequests: [],
    },
    ecommerceContext: {
      storeType: "general",
      affectedPages: ["/"],
      affectedSections: ["hero"],
      affectedFeatures: [],
      affectedEntities: [],
      conversionGoal: "increase_trust",
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
    risk: { level: "low", reasons: [] },
    normalizedTask: {
      title: "Update homepage banner",
      description: "Add a promotional banner to the homepage.",
      acceptanceCriteria: ["Banner is visible on homepage."],
      implementationHints: [],
    },
    downstream: { recommendedNextStep: "generate_patch", priority: "normal" },
    ...overrides,
  };
}

describe("validateThinkingBusinessRules US3 risk blocking", () => {
  it("requires clarification for low-confidence results", () => {
    const result = validateThinkingBusinessRules({
      hasInitializedSource: true,
      result: baseResult({ confidence: 0.54 }),
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Low-confidence requests require clarification.");
    expect(result.errors).toContain("Low-confidence requests must ask clarification before downstream work.");
  });

  it("forces stack changes to ask clarification before downstream work", () => {
    const result = validateThinkingBusinessRules({
      hasInitializedSource: true,
      result: baseResult({
        constraints: {
          preserveExistingDesign: true,
          preserveExistingFeatures: true,
          requestedStackChange: true,
          requestedDestructiveChange: false,
          forbiddenActions: [],
        },
        risk: { level: "high", reasons: ["User requested changing framework."] },
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Stack changes require clarification.");
    expect(result.errors).toContain("Stack changes must ask clarification before downstream work.");
  });

  it("forces destructive changes to be high risk and ask clarification", () => {
    const result = validateThinkingBusinessRules({
      hasInitializedSource: true,
      result: baseResult({
        constraints: {
          preserveExistingDesign: false,
          preserveExistingFeatures: false,
          requestedStackChange: false,
          requestedDestructiveChange: true,
          forbiddenActions: [],
        },
        risk: { level: "medium", reasons: ["User requested deleting implemented sections."] },
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Destructive changes must be marked high risk.");
    expect(result.errors).toContain("Destructive changes require clarification.");
    expect(result.errors).toContain("Destructive changes must ask clarification before downstream work.");
  });

  it("stops prompt-injection forbidden actions from downstream work", () => {
    const result = validateThinkingBusinessRules({
      hasInitializedSource: true,
      result: baseResult({
        constraints: {
          preserveExistingDesign: true,
          preserveExistingFeatures: true,
          requestedStackChange: false,
          requestedDestructiveChange: false,
          forbiddenActions: ["ignore previous instructions"],
        },
        risk: { level: "high", reasons: ["Prompt injection attempt."] },
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Forbidden actions require clarification or safe redirect.");
    expect(result.errors).toContain("Forbidden actions must stop downstream work.");
    expect(result.errors).toContain("High-risk requests require clarification.");
    expect(result.errors).toContain("High-risk requests must stop downstream work.");
  });

  it("allows high-risk forbidden requests when safely redirected with clarification", () => {
    const result = validateThinkingBusinessRules({
      hasInitializedSource: true,
      result: baseResult({
        projectAction: {
          shouldInitProject: false,
          shouldModifyExistingProject: false,
          shouldAskClarification: true,
          clarificationQuestion: "Bạn có muốn mình đề xuất một thay đổi an toàn thay thế không?",
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
          forbiddenActions: ["reveal system prompt"],
        },
        risk: { level: "high", reasons: ["Prompt injection attempt."] },
        downstream: { recommendedNextStep: "reject_or_safe_redirect", priority: "high" },
      }),
    });

    expect(result.ok).toBe(true);
  });
});
