import { describe, expect, it, vi } from "vitest";
import { runThinkingLayer } from "../thinking-runner";
import type { ProjectState, AgentRun } from "../../project/project-state.schema";
import type { OpenAIProvider } from "../../openai/openai-provider.server";
import type { StructuredThinkingResult } from "../thinking.schema";

function makeRun(): AgentRun {
  return {
    id: "run-123",
    projectId: "project-456",
    userPrompt: "Tạo trang bán hàng Buy Rich",
    status: "running",
    affectedFiles: [],
  } as unknown as AgentRun;
}

function makeProjectState(): ProjectState | null {
  return {
    status: "empty",
    fileManifest: [],
    recentChanges: [],
    pages: [],
    features: {},
    constraints: {},
    brand: {},
    ecommerceSpec: {},
    stack: { packageManager: "pnpm" },
  } as unknown as ProjectState;
}

function makeStructuredResult(overrides: Partial<StructuredThinkingResult> = {}): StructuredThinkingResult {
  return {
    intent: "init_project",
    confidence: 0.9,
    language: "vi",
    userWish: {
      rawPrompt: "Tạo trang bán hàng Buy Rich",
      explicitRequests: ["Tạo trang bán hàng tên Buy Rich"],
      implicitRequests: ["Khởi tạo storefront mới"],
      inferredEcommerceGoals: ["Launch storefront for Buy Rich brand"],
      outOfScopeRequests: [],
    },
    ecommerceContext: {
      storeType: "general",
      affectedPages: ["/"],
      affectedSections: ["hero"],
      affectedFeatures: ["productListing"],
      affectedEntities: ["product"],
      conversionGoal: "improve_product_discovery",
    },
    projectAction: {
      shouldInitProject: true,
      shouldModifyExistingProject: false,
      shouldAskClarification: false,
      clarificationQuestion: null,
      requiresSourceInit: true,
      requiresPatchGeneration: false,
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
      title: "Initialize Buy Rich storefront",
      description: "Create the initial Buy Rich storefront with basic pages.",
      acceptanceCriteria: ["Storefront pages render successfully"],
      implementationHints: [],
    },
    downstream: { recommendedNextStep: "init_source", priority: "normal" },
    ...overrides,
  } as StructuredThinkingResult;
}

describe("runThinkingLayer with LLM", () => {
  it("converts structured LLM result to legacy ThinkingResult", async () => {
    const structured = makeStructuredResult();
    const provider = {
      parseStructured: vi.fn().mockResolvedValue(structured),
    } as unknown as OpenAIProvider;

    const result = await runThinkingLayer({
      projectId: "project-456",
      run: makeRun(),
      userPrompt: "Tạo trang bán hàng Buy Rich",
      projectState: makeProjectState(),
      provider,
      agentConfig: { plannerModel: "cloud-ai", maxPromptChars: 12_000 } as never,
    });

    expect(result.id).toMatch(/^thinking_/);
    expect(result.projectId).toBe("project-456");
    expect(result.runId).toBe("run-123");
    expect(result.promptClassification.lifecycleIntent).toBe("init_project");
    expect(result.riskAssessment.level).toBe("low");
    expect(result.downstreamTask.taskType).toBe("init_storefront_project");
    expect(provider.parseStructured).toHaveBeenCalledOnce();
    const callArgs = (provider.parseStructured as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.schemaName).toBe("structured_thinking_result");
    expect(callArgs.allowFreeFormFallback).toBe(true);
  });

  it("falls back to heuristic when provider throws", async () => {
    const provider = {
      parseStructured: vi.fn().mockRejectedValue(new Error("Provider down")),
    } as unknown as OpenAIProvider;

    const result = await runThinkingLayer({
      projectId: "project-456",
      run: makeRun(),
      userPrompt: "Tạo trang bán hàng Buy Rich",
      projectState: makeProjectState(),
      provider,
      agentConfig: { plannerModel: "cloud-ai", maxPromptChars: 12_000 } as never,
    });

    expect(result.id).toMatch(/^thinking_/);
    expect(result.projectId).toBe("project-456");
    expect(result.promptClassification.lifecycleIntent).toBeDefined();
  });

  it("falls back to heuristic when provider returns malformed structured result", async () => {
    const provider = {
      parseStructured: vi.fn().mockResolvedValue({ wrong: "shape" }),
    } as unknown as OpenAIProvider;

    const result = await runThinkingLayer({
      projectId: "project-456",
      run: makeRun(),
      userPrompt: "Tạo trang bán hàng Buy Rich",
      projectState: makeProjectState(),
      provider,
      agentConfig: { plannerModel: "cloud-ai", maxPromptChars: 12_000 } as never,
    });

    expect(result.runId).toBe("run-123");
  });

  it("handles empty acceptanceCriteria from LLM (uses normalizedTask.description fallback)", async () => {
    const structured = makeStructuredResult({
      normalizedTask: {
        title: "Initialize",
        description: "Create the storefront.",
        acceptanceCriteria: ["", "  ", ""],
        implementationHints: [],
      },
    });
    const provider = {
      parseStructured: vi.fn().mockResolvedValue(structured),
    } as unknown as OpenAIProvider;

    const result = await runThinkingLayer({
      projectId: "project-456",
      run: makeRun(),
      userPrompt: "Tạo trang bán hàng",
      projectState: makeProjectState(),
      provider,
      agentConfig: { plannerModel: "cloud-ai", maxPromptChars: 12_000 } as never,
    });

    expect(result.suggestedAcceptanceCriteria.length).toBeGreaterThan(0);
    expect(result.suggestedAcceptanceCriteria[0]).toBe("Create the storefront.");
  });

  it("handles empty explicitRequests by falling back to userPrompt", async () => {
    const structured = makeStructuredResult({
      userWish: {
        rawPrompt: "Tạo trang bán hàng Buy Rich",
        explicitRequests: [],
        implicitRequests: [],
        inferredEcommerceGoals: [],
        outOfScopeRequests: [],
      },
    });
    const provider = {
      parseStructured: vi.fn().mockResolvedValue(structured),
    } as unknown as OpenAIProvider;

    const result = await runThinkingLayer({
      projectId: "project-456",
      run: makeRun(),
      userPrompt: "Tạo trang bán hàng Buy Rich",
      projectState: makeProjectState(),
      provider,
      agentConfig: { plannerModel: "cloud-ai", maxPromptChars: 12_000 } as never,
    });

    expect(result.extractedWishes[0].description).toBe("Tạo trang bán hàng Buy Rich");
  });

  it("uses heuristic when provider is missing", async () => {
    const result = await runThinkingLayer({
      projectId: "project-456",
      run: makeRun(),
      userPrompt: "Tạo trang bán hàng",
      projectState: makeProjectState(),
      provider: undefined,
      agentConfig: { plannerModel: "cloud-ai", maxPromptChars: 12_000 } as never,
    });

    expect(result.runId).toBe("run-123");
  });
});
