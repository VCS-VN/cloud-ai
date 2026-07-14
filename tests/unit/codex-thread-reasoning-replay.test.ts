import { describe, expect, it, vi } from "vitest";

// Per-test control over what the mocked thread's runStreamed yields, and how
// many times it was invoked (the retry-count assertion hinges on this).
let runStreamedCalls = 0;
let eventsToYield: Array<Record<string, unknown>> = [];

vi.mock("@openai/codex-sdk", () => {
  function Codex(this: unknown) {
    (this as { startThread: () => unknown }).startThread = () => ({
      id: "thread-mock",
      runStreamed: async () => {
        runStreamedCalls += 1;
        return {
          events: (async function* () {
            for (const ev of eventsToYield) yield ev;
          })(),
        };
      },
    });
  }
  return { Codex };
});

import {
  createBoundedCodexThread,
  ReasoningReplayError,
} from "@/features/agents/codex/runtime/codex-thread.server";
import type { CodexEnvAvailable } from "@/server/env/codex";

const env: CodexEnvAvailable = {
  available: true,
  apiKey: "test-key",
  baseUrl: "https://example.test/api",
  codexHome: "/tmp/codex",
  model: "test-model",
  skillsRoot: "/tmp/skills",
  maxSkillChars: 32000,
  llmTieBreakGap: 10,
  maxSelectedSkills: 3,
  initBatchConcurrency: 3,
};

const REPLAY_MESSAGE = JSON.stringify({
  error: {
    code: "invalid_request_error",
    message: "content is required (ID: abc)",
    param: "input[3].content",
    type: "invalid_request_error",
  },
});

describe("runTurnStreamed — reasoning-replay fast-fail (provider drops encrypted_content)", () => {
  it("throws ReasoningReplayError on a `content is required (input[N].content)` error event", async () => {
    runStreamedCalls = 0;
    eventsToYield = [{ type: "error", message: REPLAY_MESSAGE }];
    const thread = createBoundedCodexThread({ env, draftWorkspacePath: "/tmp/draft" });
    await expect(
      thread.runTurnStreamed({ prompt: "build something" }, () => undefined),
    ).rejects.toBeInstanceOf(ReasoningReplayError);
  });

  it("does NOT retry — fails after exactly one CLI invocation, not the 10x backoff loop", async () => {
    runStreamedCalls = 0;
    eventsToYield = [{ type: "error", message: REPLAY_MESSAGE }];
    const thread = createBoundedCodexThread({ env, draftWorkspacePath: "/tmp/draft" });
    await expect(
      thread.runTurnStreamed({ prompt: "build something" }, () => undefined),
    ).rejects.toBeInstanceOf(ReasoningReplayError);
    expect(runStreamedCalls).toBe(1);
  });

  it("also fast-fails when the message arrives via turn.failed instead of an error event", async () => {
    runStreamedCalls = 0;
    eventsToYield = [{ type: "turn.failed", error: { message: REPLAY_MESSAGE } }];
    const thread = createBoundedCodexThread({ env, draftWorkspacePath: "/tmp/draft" });
    await expect(
      thread.runTurnStreamed({ prompt: "build something" }, () => undefined),
    ).rejects.toBeInstanceOf(ReasoningReplayError);
    expect(runStreamedCalls).toBe(1);
  });
});
