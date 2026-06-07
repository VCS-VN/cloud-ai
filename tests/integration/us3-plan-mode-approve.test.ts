import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

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
    __publish: publish,
  };
});

import * as codexSdk from "@openai/codex-sdk";
import * as fsAuditModule from "@/features/agents/codex/boundary/filesystem-audit.server";
import * as registryModule from "@/features/agents/codex/runtime/builder-run-registry.server";
import { runPlanTurn, resolvePlan, buildExecuteTurnPrompt } from "@/features/agents/codex/runtime/plan-mode.server";
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
const handle = (registryModule as unknown as { __handle: { events: unknown[] } }).__handle;

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
  const snapshots: unknown[] = [];
  return {
    planPhases,
    snapshots,
    setPlanPhase: vi.fn(async (_runId: string, phase: unknown) => {
      planPhases.push(phase);
    }),
    setClarificationSnapshot: vi.fn(async (_runId: string, snap: unknown) => {
      snapshots.push(snap);
    }),
  };
}

beforeEach(() => {
  startThreadMock.mockReset();
  takeSnapshotMock.mockReset();
  diffSnapshotsMock.mockReset();
  handle.events.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("US3 — plan turn → approve flow", () => {
  it("plan turn emits awaiting_clarification(plan_review) and zero workspace mutation", async () => {
    const beforeSnap = { fingerprint: "before" };
    const afterSnap = { fingerprint: "after" };
    takeSnapshotMock.mockResolvedValueOnce(beforeSnap).mockResolvedValueOnce(afterSnap);
    diffSnapshotsMock.mockReturnValueOnce({ added: [], modified: [], removed: [] });
    startThreadMock.mockReturnValueOnce({
      id: "thread-plan",
      run: vi.fn(async () => ({
        items: [],
        finalResponse: "## Understanding\n...\n## Findings\n...",
        usage: null,
      })),
    });

    const repo = makeFakeRepo();
    const result = await runPlanTurn(baseCtx, {
      draftWorkspacePath: "/tmp/draft",
      agentRunRepository: repo as never,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.planMarkdown).toContain("Understanding");
    // Snapshot diff was empty — SC-006 satisfied.
    expect(diffSnapshotsMock).toHaveBeenCalledOnce();
    // plan_phase persisted, clarification_snapshot persisted with plan_review.
    expect(repo.planPhases.at(-1)).toMatchObject({ stage: "plan_ready" });
    expect(repo.snapshots.at(-1)).toMatchObject({ questionType: "plan_review" });
    // SSE-side: awaiting_clarification published with metadata.questionType=plan_review.
    const awaiting = handle.events.find(
      (e) => (e as { type: string }).type === "awaiting_clarification",
    ) as { metadata?: { questionType: string } } | undefined;
    expect(awaiting?.metadata?.questionType).toBe("plan_review");
  });

  it("approving the plan flips planPhase.stage → executing", async () => {
    const repo = makeFakeRepo();
    await resolvePlan(baseCtx, "approve", "## plan", { agentRunRepository: repo as never });
    expect(repo.planPhases.at(-1)).toMatchObject({ stage: "executing" });
  });

  it("execute-turn prompt seeds the original task + approved plan", () => {
    const prompt = buildExecuteTurnPrompt("thêm image vào hero", "## plan");
    expect(prompt).toContain("Original task: thêm image vào hero");
    expect(prompt).toContain("Approved plan:\n## plan");
    expect(prompt).toContain("Execute the plan now.");
  });
});
