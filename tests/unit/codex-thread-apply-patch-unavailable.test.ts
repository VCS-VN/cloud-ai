import { describe, expect, it, vi } from "vitest";

// Per-test control over what the mocked thread's runStreamed yields, and how
// many times it was invoked (the no-retry assertion hinges on this).
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
  ApplyPatchUnavailableError,
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
};

// Verbatim phrasings the model emitted on the VPS run (b3c2f41d) where the
// bwrap sandbox blocked apply_patch and the model narrated code as text.
const LOG_PHRASINGS = [
  "I understand you want to create a grocery retail storefront. Since the apply_patch function isn't available in this environment, I'll provide you with the complete code for the foundation files.",
  "I need to create the foundation files for your grocery store. Since the apply_patch function isn't available in this environment, I'll provide you with all the necessary code.",
  "I understand you want me to create the foundation files for your grocery store. Since the apply_patch function isn't working in this environment, I'll provide you with all the code you need.",
];

function agentMessageEvents(text: string): Array<Record<string, unknown>> {
  return [
    { type: "item.completed", item: { type: "agent_message", text } },
    { type: "turn.completed", usage: null },
  ];
}

describe("runTurnStreamed — apply_patch-unavailable fast-fail (sandbox blocks file writes)", () => {
  it("throws ApplyPatchUnavailableError on the exact phrasings from the VPS log", async () => {
    for (const phrasing of LOG_PHRASINGS) {
      runStreamedCalls = 0;
      eventsToYield = agentMessageEvents(phrasing);
      const thread = createBoundedCodexThread({ env, draftWorkspacePath: "/tmp/draft" });
      await expect(
        thread.runTurnStreamed({ prompt: "build something" }, () => undefined),
      ).rejects.toBeInstanceOf(ApplyPatchUnavailableError);
    }
  });

  it("does NOT retry — fails after exactly one CLI invocation, not the 10x backoff loop", async () => {
    runStreamedCalls = 0;
    eventsToYield = agentMessageEvents(LOG_PHRASINGS[0]);
    const thread = createBoundedCodexThread({ env, draftWorkspacePath: "/tmp/draft" });
    await expect(
      thread.runTurnStreamed({ prompt: "build something" }, () => undefined),
    ).rejects.toBeInstanceOf(ApplyPatchUnavailableError);
    expect(runStreamedCalls).toBe(1);
  });

  it("error message points at the CODEX_DISABLE_SANDBOX=true remediation", async () => {
    runStreamedCalls = 0;
    eventsToYield = agentMessageEvents(LOG_PHRASINGS[0]);
    const thread = createBoundedCodexThread({ env, draftWorkspacePath: "/tmp/draft" });
    await expect(
      thread.runTurnStreamed({ prompt: "build something" }, () => undefined),
    ).rejects.toThrow(/CODEX_DISABLE_SANDBOX=true/);
  });

  it("does NOT fire when the turn actually wrote a file (apply_patch worked)", async () => {
    runStreamedCalls = 0;
    eventsToYield = [
      {
        type: "item.completed",
        item: {
          type: "file_change",
          status: "completed",
          changes: [{ path: "src/lib/format-money.ts" }],
        },
      },
      // Even if some later text mentions apply_patch, a turn that shipped a
      // file is not a sandbox failure.
      {
        type: "item.completed",
        item: { type: "agent_message", text: "Created the foundation files." },
      },
      { type: "turn.completed", usage: null },
    ];
    const thread = createBoundedCodexThread({ env, draftWorkspacePath: "/tmp/draft" });
    const summary = await thread.runTurnStreamed(
      { prompt: "build something" },
      () => undefined,
    );
    expect(summary.fileChanges).toContain("src/lib/format-money.ts");
  });

  it("does NOT fire on ordinary prose that merely mentions apply_patch", async () => {
    runStreamedCalls = 0;
    eventsToYield = agentMessageEvents(
      "I'll use apply_patch to create each file now.",
    );
    const thread = createBoundedCodexThread({ env, draftWorkspacePath: "/tmp/draft" });
    const summary = await thread.runTurnStreamed(
      { prompt: "build something" },
      () => undefined,
    );
    expect(summary.finalResponse).toContain("apply_patch");
  });
});
