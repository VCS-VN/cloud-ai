import { describe, expect, it } from "vitest";
import {
  classifyPromptComplexity,
  parseClassifierOutput,
  CLASSIFIER_FALLBACK,
} from "@/features/agents/codex/runtime/plan-classifier.server";
import type { CodexEnvAvailable } from "@/server/env/codex";

const FAKE_ENV: CodexEnvAvailable = {
  available: true,
  codexHome: "/tmp/codex",
  apiKey: "fake",
  model: "fake",
  baseUrl: undefined,
  skillsRoot: "/tmp/skills",
  maxSkillChars: 32000,
  llmTieBreakGap: 10,
  maxSelectedSkills: 3,
};

describe("parseClassifierOutput", () => {
  it("parses bare JSON simple/en", () => {
    const out = parseClassifierOutput('{"complexity":"simple","language":"en"}');
    expect(out).toEqual({ complexity: "simple", language: "en" });
  });

  it("parses fenced JSON complex/vi", () => {
    const out = parseClassifierOutput('```json\n{"complexity":"complex","language":"vi"}\n```');
    expect(out).toEqual({ complexity: "complex", language: "vi" });
  });

  it("falls back EN on invalid language regex (3-letter code)", () => {
    const out = parseClassifierOutput('{"complexity":"complex","language":"eng"}');
    expect(out.language).toBe("en");
    expect(out.complexity).toBe("complex");
  });

  it("falls back to CLASSIFIER_FALLBACK on invalid complexity", () => {
    const out = parseClassifierOutput('{"complexity":"medium","language":"en"}');
    expect(out).toEqual(CLASSIFIER_FALLBACK);
  });

  it("falls back to CLASSIFIER_FALLBACK on garbage input", () => {
    const out = parseClassifierOutput("not json at all");
    expect(out).toEqual(CLASSIFIER_FALLBACK);
  });
});

describe("classifyPromptComplexity", () => {
  it("propagates AbortError immediately (no swallow)", async () => {
    const controller = new AbortController();
    controller.abort();
    const fakeThread = {
      runTurn: async () => {
        throw new DOMException("Aborted", "AbortError");
      },
    };
    await expect(
      classifyPromptComplexity({
        runId: "r1",
        prompt: "hi",
        signal: controller.signal,
        env: FAKE_ENV,
        draftWorkspacePath: "/tmp",
        thread: fakeThread,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("returns CLASSIFIER_FALLBACK on non-abort thread error (lenient)", async () => {
    const fakeThread = {
      runTurn: async () => {
        throw new Error("upstream 500");
      },
    };
    const out = await classifyPromptComplexity({
      runId: "r2",
      prompt: "hi",
      env: FAKE_ENV,
      draftWorkspacePath: "/tmp",
      thread: fakeThread,
    });
    expect(out).toEqual(CLASSIFIER_FALLBACK);
  });

  it("returns parsed decision when thread succeeds", async () => {
    const fakeThread = {
      runTurn: async () => ({
        finalResponse: '{"complexity":"simple","language":"vi"}',
        usage: null,
        fileChanges: [],
        skillToolCalls: [],
      }),
    };
    const out = await classifyPromptComplexity({
      runId: "r3",
      prompt: "đổi text hero",
      env: FAKE_ENV,
      draftWorkspacePath: "/tmp",
      thread: fakeThread,
    });
    expect(out).toEqual({ complexity: "simple", language: "vi" });
  });
});
