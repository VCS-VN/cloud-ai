import { describe, expect, it } from "vitest";
import {
  analyzeScope,
  parseScopeAnalysis,
} from "@/features/agents/codex/runtime/scope-analysis.server";
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
  initBatchConcurrency: 3,
};

const MANIFEST = [
  "src/routes/index.tsx",
  "src/components/store/hero.tsx",
  "src/components/layout/site-header.tsx",
];

function turn(finalResponse: string) {
  return {
    runTurn: async () => ({
      finalResponse,
      usage: null,
      fileChanges: [],
      skillToolCalls: [],
      reasoning: [],
    }),
  };
}

describe("parseScopeAnalysis", () => {
  it("parses bare JSON and keeps only manifest-present files", () => {
    const out = parseScopeAnalysis(
      '{"relevantFiles":["src/routes/index.tsx","src/does/not/exist.tsx"],"approach":"Edit the hero heading in index."}',
      MANIFEST,
    );
    expect(out).toEqual({
      relevantFiles: ["src/routes/index.tsx"],
      approach: "Edit the hero heading in index.",
    });
  });

  it("parses fenced JSON", () => {
    const out = parseScopeAnalysis(
      '```json\n{"relevantFiles":["src/components/store/hero.tsx"],"approach":"Change hero copy."}\n```',
      MANIFEST,
    );
    expect(out?.relevantFiles).toEqual(["src/components/store/hero.tsx"]);
  });

  it("strips a leading ./ before matching the manifest", () => {
    const out = parseScopeAnalysis(
      '{"relevantFiles":["./src/routes/index.tsx"],"approach":"x"}',
      MANIFEST,
    );
    expect(out?.relevantFiles).toEqual(["src/routes/index.tsx"]);
  });

  it("returns empty relevantFiles when none match (no hallucinated focus)", () => {
    const out = parseScopeAnalysis(
      '{"relevantFiles":["src/made/up.tsx"],"approach":"unsure"}',
      MANIFEST,
    );
    expect(out).toEqual({ relevantFiles: [], approach: "unsure" });
  });

  it("returns null on garbage input", () => {
    expect(parseScopeAnalysis("not json", MANIFEST)).toBeNull();
  });

  it("returns null when schema does not match", () => {
    expect(parseScopeAnalysis('{"relevantFiles":"nope"}', MANIFEST)).toBeNull();
  });
});

describe("analyzeScope", () => {
  it("propagates AbortError immediately", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      analyzeScope({
        runId: "r1",
        prompt: "hi",
        fileManifest: MANIFEST,
        language: "en",
        signal: controller.signal,
        env: FAKE_ENV,
        draftWorkspacePath: "/tmp",
        thread: {
          runTurn: async () => {
            throw new DOMException("Aborted", "AbortError");
          },
        },
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("returns null on non-abort thread error (advisory, never blocks)", async () => {
    const out = await analyzeScope({
      runId: "r2",
      prompt: "hi",
      fileManifest: MANIFEST,
      language: "en",
      env: FAKE_ENV,
      draftWorkspacePath: "/tmp",
      thread: {
        runTurn: async () => {
          throw new Error("upstream 500");
        },
      },
    });
    expect(out).toBeNull();
  });

  it("returns parsed scope when the thread succeeds", async () => {
    const out = await analyzeScope({
      runId: "r3",
      prompt: "đổi hero text",
      fileManifest: MANIFEST,
      language: "vi",
      env: FAKE_ENV,
      draftWorkspacePath: "/tmp",
      thread: turn(
        '{"relevantFiles":["src/routes/index.tsx"],"approach":"Sửa tiêu đề hero."}',
      ),
    });
    expect(out).toEqual({
      relevantFiles: ["src/routes/index.tsx"],
      approach: "Sửa tiêu đề hero.",
    });
  });

  it("retries once on malformed output then parses the second attempt", async () => {
    let calls = 0;
    const out = await analyzeScope({
      runId: "r4",
      prompt: "change hero",
      fileManifest: MANIFEST,
      language: "en",
      env: FAKE_ENV,
      draftWorkspacePath: "/tmp",
      thread: {
        runTurn: async () => {
          calls++;
          return {
            finalResponse:
              calls === 1
                ? "Sure: focus on index"
                : '{"relevantFiles":["src/routes/index.tsx"],"approach":"edit index"}',
            usage: null,
            fileChanges: [],
            skillToolCalls: [],
            reasoning: [],
          };
        },
      },
    });
    expect(calls).toBe(2);
    expect(out?.relevantFiles).toEqual(["src/routes/index.tsx"]);
  });

  it("returns null when every retry is malformed", async () => {
    let calls = 0;
    const out = await analyzeScope({
      runId: "r5",
      prompt: "hi",
      fileManifest: MANIFEST,
      language: "en",
      env: FAKE_ENV,
      draftWorkspacePath: "/tmp",
      thread: {
        runTurn: async () => {
          calls++;
          return {
            finalResponse: "not json",
            usage: null,
            fileChanges: [],
            skillToolCalls: [],
            reasoning: [],
          };
        },
      },
    });
    expect(calls).toBe(2);
    expect(out).toBeNull();
  });
});
