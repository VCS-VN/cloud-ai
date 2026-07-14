import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import type { CodexEnvAvailable } from "@/server/env/codex";
import { resetViolationStateForTest } from "@/features/agents/codex/runtime/violation-counter.server";

vi.mock("@openai/codex-sdk", async () => ({
  Codex: class {
    startThread() {
      return {
        id: "t1",
        async run() {
          return { items: [], finalResponse: "ok", usage: null };
        },
        async runStreamed() {
          return {
            events: (async function* () {
              yield { type: "turn.completed", usage: null };
            })(),
          };
        },
      };
    }
  },
}));

vi.mock("@/features/agents/codex/skills/template-scanner.server", () => ({
  scanActiveTemplates: vi.fn(async () => []),
  aggregateTemplateScans: vi.fn(() => ({
    required: new Set(),
    recommended: new Set(),
  })),
}));


async function seedSymlinkLeak(projectId: string, tmpRoot: string): Promise<void> {
  const draftDir = path.join(tmpRoot, projectId, "drafts");
  // poll until the orchestrator has created a draft directory
  for (let i = 0; i < 50; i++) {
    try {
      const dirs = await fs.readdir(draftDir);
      if (dirs.length > 0) {
        const target = path.join(draftDir, dirs[0]);
        await fs.symlink(tmpRoot, path.join(target, "leaky"));
        return;
      }
    } catch {
      // not created yet
    }
    await new Promise((r) => setTimeout(r, 5));
  }
}

vi.mock("@/server/config/paths.server", async () => {
  const real = await vi.importActual<typeof import("@/server/config/paths.server")>(
    "@/server/config/paths.server",
  );
  return { ...real, getProjectWorkspaceRoot: vi.fn() };
});

vi.mock("@/features/agents/codex/validation/typecheck.server", () => ({
  runTypecheck: vi.fn(async () => ({ ok: true, durationMs: 1 })),
  runProcess: vi.fn(),
  countErrors: vi.fn(),
}));
vi.mock("@/features/agents/codex/validation/build.server", () => ({
  runBuild: vi.fn(async () => ({ ok: true, durationMs: 1 })),
}));
vi.mock("@/features/agents/codex/validation/preview-health.server", () => ({
  runPreviewHealth: vi.fn(async () => ({
    ok: true,
    pm2: { name: "x", status: "online" },
    rootStatus: 200,
    routes: [],
    optionalFailures: [],
  })),
  CORE_HARD_GATE_ROUTES: ["/", "/products", "/cart", "/checkout"],
}));

let tmpRoot: string;

beforeEach(async () => {
  resetViolationStateForTest();
  (globalThis as any).__codexProjectRoot = undefined;
  const { getProjectWorkspaceRoot } = await import(
    "@/server/config/paths.server"
  );
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "boundary-"));
  (getProjectWorkspaceRoot as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (projectId: string) => path.join(tmpRoot, projectId),
  );
});

async function findDraft(projectId: string): Promise<string> {
  const draftDir = path.join(tmpRoot, projectId, "drafts");
  const dirs = await fs.readdir(draftDir);
  return path.join(draftDir, dirs[0]);
}

async function makeEnv(): Promise<CodexEnvAvailable> {
  return {
    available: true,
    codexHome: path.join(tmpRoot, "codex-home"),
    apiKey: "k",
    model: "m",
    baseUrl: undefined,
    skillsRoot: path.join(tmpRoot, "skills"),
      maxSkillChars: 32000,
      llmTieBreakGap: 10,
      maxSelectedSkills: 3,
      initBatchConcurrency: 3,
  };
}

describe("boundary violations fail closed", () => {
  it("fails with boundary_violation when symlink escapes the draft", async () => {
    const { runSmallUpdateBuilderRun, newRunId } = await import(
      "@/features/agents/codex/runtime/builder-run.server"
    );
    const projectId = "proj-bs";
    const projectDir = path.join(tmpRoot, projectId);
    await fs.mkdir(path.join(projectDir, "published"), { recursive: true });
    // place a symlink leak inside the published workspace so it gets copied into the draft
    const outsideTarget = path.join(tmpRoot, "outside.txt");
    await fs.writeFile(outsideTarget, "x");
    await fs.symlink(outsideTarget, path.join(projectDir, "published", "leak"));

    const ctx = {
      projectId,
      userId: "u1",
      runId: newRunId(),
      kind: "update" as const,
      userPrompt: "tweak",
      locale: "vi-VN",
      env: await makeEnv(),
      projectSummary: null,
    };

    const events: any[] = [];
    const outcome = await runSmallUpdateBuilderRun(ctx, (e) => events.push(e));

    expect(outcome.status).toBe("failed");
    expect(outcome.failureCode).toBe("boundary_violation");
    const failedEvent = events.find((e) => e.type === "failed");
    expect(failedEvent?.message).toBeDefined();
    expect(failedEvent.message).not.toContain(tmpRoot);
  });

  it("does not leak absolute paths in user-visible failed messages", async () => {
    const { runSmallUpdateBuilderRun, newRunId } = await import(
      "@/features/agents/codex/runtime/builder-run.server"
    );
    const projectId = "proj-bp";
    const projectDir = path.join(tmpRoot, projectId);
    await fs.mkdir(path.join(projectDir, "published"), { recursive: true });
    await fs.symlink(tmpRoot, path.join(projectDir, "published", "leaky"));

    const ctx = {
      projectId,
      userId: "u1",
      runId: newRunId(),
      kind: "update" as const,
      userPrompt: "tweak",
      locale: "vi-VN",
      env: await makeEnv(),
      projectSummary: null,
    };
    const events: any[] = [];
    await runSmallUpdateBuilderRun(ctx, (e) => events.push(e));

    const failedMessages = events
      .filter((e) => e.type === "failed")
      .map((e) => e.message);
    expect(failedMessages.length).toBeGreaterThan(0);
    for (const m of failedMessages) {
      expect(m).not.toContain(tmpRoot);
      expect(m).not.toContain(path.sep + "drafts" + path.sep);
    }
  });

  it("surfaces boundary_violation via the recordBoundaryViolation counter", async () => {
    const { runSmallUpdateBuilderRun, newRunId } = await import(
      "@/features/agents/codex/runtime/builder-run.server"
    );
    const { getProjectViolationState } = await import(
      "@/features/agents/codex/runtime/violation-counter.server"
    );
    const projectId = "proj-bc";
    const projectDir = path.join(tmpRoot, projectId);
    await fs.mkdir(path.join(projectDir, "published"), { recursive: true });
    await fs.symlink(tmpRoot, path.join(projectDir, "published", "leaky"));

    const ctx = {
      projectId,
      userId: "u1",
      runId: newRunId(),
      kind: "update" as const,
      userPrompt: "tweak",
      locale: "vi-VN",
      env: await makeEnv(),
      projectSummary: null,
    };

    await runSmallUpdateBuilderRun(ctx, () => {});

    const state = getProjectViolationState(projectId);
    expect(state?.count).toBeGreaterThanOrEqual(1);
  });
});
