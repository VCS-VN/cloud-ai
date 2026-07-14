import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@openai/codex-sdk", () => {
  const startThread = vi.fn();
  function Codex(this: unknown) {
    (this as { startThread: typeof startThread }).startThread = startThread;
  }
  return { Codex, __startThread: startThread };
});

vi.mock("@/features/agents/codex/boundary/filesystem-audit.server", () => {
  const takeSnapshot = vi.fn();
  const diffSnapshots = vi.fn();
  return {
    takeSnapshot,
    diffSnapshots,
    __takeSnapshot: takeSnapshot,
    __diffSnapshots: diffSnapshots,
  };
});

vi.mock("@/features/agents/codex/runtime/builder-run-registry.server", () => {
  const handle = {
    runId: "run-1",
    projectId: "proj-1",
    userId: "u",
    status: "queued",
    abortController: new AbortController(),
    events: [] as unknown[],
    subscribers: new Set(),
    startedAt: 0,
    pendingSkills: [],
    clarificationPrompt: null,
    userPrompt: null,
    resumeFn: null,
    loadedSkills: [],
  };
  const publish = vi.fn((h: typeof handle, event: unknown) => {
    h.events.push(event);
  });
  return {
    getBuilderRunHandle: () => handle,
    publishBuilderRunEvent: publish,
    __handle: handle,
  };
});

import * as codexSdk from "@openai/codex-sdk";
import * as fsAuditModule from "@/features/agents/codex/boundary/filesystem-audit.server";
import { runPlanTurn, resolvePlan } from "@/features/agents/codex/runtime/plan-mode.server";
import type { BuilderRunContext } from "@/features/agents/codex/runtime/builder-run.server";
import type { CodexEnvAvailable } from "@/server/env/codex";

const startThreadMock = (codexSdk as unknown as { __startThread: ReturnType<typeof vi.fn> })
  .__startThread;
const takeSnapshotMock = (
  fsAuditModule as unknown as { __takeSnapshot: ReturnType<typeof vi.fn> }
).__takeSnapshot;
const diffSnapshotsMock = (
  fsAuditModule as unknown as { __diffSnapshots: ReturnType<typeof vi.fn> }
).__diffSnapshots;

const env: CodexEnvAvailable = {
  available: true,
  apiKey: "k",
  baseUrl: "https://x",
  codexHome: "/tmp/codex",
  model: "m",
  skillsRoot: "/tmp/skills",
  maxSkillChars: 1000,
  llmTieBreakGap: 5,
  maxSelectedSkills: 3,
  initBatchConcurrency: 3,
};

const baseCtx: BuilderRunContext = {
  projectId: "proj-1",
  userId: "u",
  runId: "run-1",
  kind: "update",
  userPrompt: "thêm image vào hero",
  locale: "vi",
  env,
  projectSummary: null,
  reasoningEffort: "medium",
  planMode: true,
};

function makeFakeRepo() {
  const planPhases: unknown[] = [];
  return {
    planPhases,
    setPlanPhase: vi.fn(async (_runId: string, phase: unknown) => {
      planPhases.push(phase);
    }),
    setClarificationSnapshot: vi.fn(async () => undefined),
  };
}

beforeEach(() => {
  startThreadMock.mockReset();
  takeSnapshotMock.mockReset();
  diffSnapshotsMock.mockReset();
});

describe("US3 — plan turn → reject flow", () => {
  it("rejecting flips planPhase.stage → plan_rejected and clears clarification snapshot", async () => {
    const repo = makeFakeRepo();
    await resolvePlan(baseCtx, "reject", "## plan markdown", {
      agentRunRepository: repo as never,
    });
    expect(repo.planPhases.at(-1)).toMatchObject({
      stage: "plan_rejected",
      planMarkdown: "## plan markdown",
    });
    expect(repo.setClarificationSnapshot).toHaveBeenCalledWith("run-1", null);
  });

  it("plan turn that produces a file_change item is hard-rejected with blocked_request (T055 abort guard)", async () => {
    takeSnapshotMock.mockResolvedValueOnce({}).mockResolvedValueOnce({});
    diffSnapshotsMock.mockReturnValueOnce({ added: [], modified: [], removed: [] });
    startThreadMock.mockReturnValueOnce({
      id: "thread-leak",
      run: vi.fn(async () => ({
        items: [
          {
            type: "file_change",
            changes: [{ path: "src/components/storefront/Hero.tsx" }],
          },
        ],
        finalResponse: "(should not happen)",
        usage: null,
      })),
    });

    const repo = makeFakeRepo();
    const result = await runPlanTurn(baseCtx, {
      draftWorkspacePath: "/tmp/draft",
      agentRunRepository: repo as never,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("blocked_request");
    // Plan phase NOT persisted as plan_ready when guard fires.
    expect(repo.planPhases.find((p) => (p as { stage: string }).stage === "plan_ready")).toBeUndefined();
  });

  it("plan turn with non-empty workspace diff is hard-rejected with blocked_request", async () => {
    takeSnapshotMock.mockResolvedValueOnce({}).mockResolvedValueOnce({});
    diffSnapshotsMock.mockReturnValueOnce({
      added: ["src/snuck-in.ts"],
      modified: [],
      removed: [],
    });
    startThreadMock.mockReturnValueOnce({
      id: "thread-mut",
      run: vi.fn(async () => ({
        items: [],
        finalResponse: "(plan only — but workspace was mutated)",
        usage: null,
      })),
    });
    const result = await runPlanTurn(baseCtx, {
      draftWorkspacePath: "/tmp/draft",
      agentRunRepository: makeFakeRepo() as never,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("blocked_request");
  });
});
