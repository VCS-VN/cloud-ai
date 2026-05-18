import { describe, expect, it } from "vitest";
import { isReasoningModel, selectReasoningEffort } from "../reasoning-effort";
import type { ThinkingResult } from "../../thinking/thinking.schema";

function makeThinking(opts: {
  riskLevel: "low" | "medium" | "high";
  taskType?: ThinkingResult["downstreamTask"]["taskType"];
}): ThinkingResult {
  return {
    riskAssessment: {
      level: opts.riskLevel,
      reasons: [],
      requiresUserConfirmation: false,
    },
    downstreamTask: {
      taskType: opts.taskType ?? "incremental_source_update",
    },
  } as unknown as ThinkingResult;
}

describe("selectReasoningEffort", () => {
  it("returns 'high' for init regardless of risk", () => {
    const result = selectReasoningEffort(makeThinking({ riskLevel: "low" }), { isInit: true });
    expect(result).toBe("high");
  });

  it("returns 'high' for high-risk update", () => {
    expect(selectReasoningEffort(makeThinking({ riskLevel: "high" }))).toBe("high");
  });

  it("returns 'medium' for medium-risk update", () => {
    expect(selectReasoningEffort(makeThinking({ riskLevel: "medium" }))).toBe("medium");
  });

  it("returns 'medium' for bug_fix", () => {
    expect(
      selectReasoningEffort(makeThinking({ riskLevel: "low", taskType: "bug_fix" })),
    ).toBe("medium");
  });

  it("returns 'medium' for design_update", () => {
    expect(
      selectReasoningEffort(makeThinking({ riskLevel: "low", taskType: "design_update" })),
    ).toBe("medium");
  });

  it("returns 'low' for default low-risk update", () => {
    expect(selectReasoningEffort(makeThinking({ riskLevel: "low" }))).toBe("low");
  });
});

describe("isReasoningModel", () => {
  it("recognizes o-series models", () => {
    expect(isReasoningModel("o1")).toBe(true);
    expect(isReasoningModel("o3-mini")).toBe(true);
    expect(isReasoningModel("o4")).toBe(true);
  });

  it("recognizes gpt-5 family", () => {
    expect(isReasoningModel("gpt-5.4")).toBe(true);
    expect(isReasoningModel("gpt-5-codex")).toBe(true);
  });

  it("rejects gpt-4 family", () => {
    expect(isReasoningModel("gpt-4o")).toBe(false);
    expect(isReasoningModel("gpt-4-turbo")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isReasoningModel(undefined)).toBe(false);
  });
});
