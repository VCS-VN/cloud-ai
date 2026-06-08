import { describe, expect, it } from "vitest";
import {
  generatePlan,
  parsePlannerOutput,
} from "@/features/agents/codex/runtime/plan-generator.server";
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

const VALID_BARE = JSON.stringify({
  tasks: [
    { id: "a1", title: "Analyze brand tone", phase: "prep" },
    { id: "b1", title: "Build the home page", phase: "build" },
    { id: "v1", title: "Validate the preview", phase: "verify" },
  ],
});

describe("parsePlannerOutput", () => {
  it("parses bare JSON object with tasks key", () => {
    const r = parsePlannerOutput(VALID_BARE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tasks).toHaveLength(3);
  });

  it("parses fenced JSON ```json", () => {
    const r = parsePlannerOutput("```json\n" + VALID_BARE + "\n```");
    expect(r.ok).toBe(true);
  });

  it("rejects 1-task list (range 2..8)", () => {
    const raw = JSON.stringify({
      tasks: [{ id: "a", title: "Single", phase: "build" }],
    });
    const r = parsePlannerOutput(raw);
    expect(r.ok).toBe(false);
  });

  it("rejects 9-task list (range 2..8)", () => {
    const tasks = Array.from({ length: 9 }, (_, i) => ({
      id: `t${i}`,
      title: `Task number ${i}`,
      phase: "build" as const,
    }));
    const raw = JSON.stringify({ tasks });
    const r = parsePlannerOutput(raw);
    expect(r.ok).toBe(false);
  });

  it("rejects task with file path in title", () => {
    const raw = JSON.stringify({
      tasks: [
        { id: "a", title: "Update src/routes/index.tsx", phase: "build" },
        { id: "b", title: "Validate the page", phase: "verify" },
      ],
    });
    const r = parsePlannerOutput(raw);
    expect(r.ok).toBe(false);
  });

  it("rejects duplicate task ids", () => {
    const raw = JSON.stringify({
      tasks: [
        { id: "dup", title: "First step", phase: "prep" },
        { id: "dup", title: "Second step", phase: "build" },
      ],
    });
    const r = parsePlannerOutput(raw);
    expect(r.ok).toBe(false);
  });

  it("rejects task with framework name in title (React)", () => {
    const raw = JSON.stringify({
      tasks: [
        { id: "a", title: "Use React hooks for state", phase: "build" },
        { id: "b", title: "Verify it works", phase: "verify" },
      ],
    });
    const r = parsePlannerOutput(raw);
    expect(r.ok).toBe(false);
  });
});

describe("generatePlan retry behavior", () => {
  it("retries once on validation failure, succeeds on second attempt", async () => {
    let calls = 0;
    const fakeThread = {
      runTurn: async () => {
        calls++;
        if (calls === 1) {
          return {
            finalResponse: '{"tasks":[{"id":"a","title":"Touch src/routes/index.tsx","phase":"build"}]}',
            usage: null,
            fileChanges: [],
            skillToolCalls: [],
          };
        }
        return {
          finalResponse: VALID_BARE,
          usage: null,
          fileChanges: [],
          skillToolCalls: [],
        };
      },
    };
    const r = await generatePlan({
      runId: "r1",
      prompt: "build a store",
      language: "en",
      env: FAKE_ENV,
      draftWorkspacePath: "/tmp",
      thread: fakeThread,
    });
    expect(r.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it("returns ok:false after retry budget", async () => {
    let calls = 0;
    const fakeThread = {
      runTurn: async () => {
        calls++;
        return {
          finalResponse: "totally not json",
          usage: null,
          fileChanges: [],
          skillToolCalls: [],
        };
      },
    };
    const r = await generatePlan({
      runId: "r2",
      prompt: "x",
      language: "en",
      env: FAKE_ENV,
      draftWorkspacePath: "/tmp",
      thread: fakeThread,
    });
    expect(r.ok).toBe(false);
    expect(calls).toBe(2);
  });

  it("propagates AbortError without retry", async () => {
    let calls = 0;
    const fakeThread = {
      runTurn: async () => {
        calls++;
        throw new DOMException("Aborted", "AbortError");
      },
    };
    await expect(
      generatePlan({
        runId: "r3",
        prompt: "x",
        language: "en",
        env: FAKE_ENV,
        draftWorkspacePath: "/tmp",
        thread: fakeThread,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(calls).toBe(1);
  });
});
