import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import type { CodexEnvAvailable } from "@/server/env/codex";

vi.mock("@openai/codex-sdk", async () => {
  return {
    Codex: class {
      startThread() {
        return {
          id: "t1",
          async run() {
            // Simulate non-trivial turn duration so the test's seedDraft
            // setTimeout(5ms) lands inside the turn (matches the original
            // flow where the codex CLI takes time before files appear).
            await new Promise((r) => setTimeout(r, 50));
            return { items: [], finalResponse: "ok", usage: null };
          },
          async runStreamed() {
            // Same delay as run(): the streamed bridge replaced run() in
            // production, but the test's seedDraft race expects a turn that
            // is slow enough for the 5ms-deferred seed to land inside it.
            await new Promise((r) => setTimeout(r, 50));
            return {
              events: (async function* () {
                yield { type: "turn.completed", usage: null };
              })(),
            };
          },
        };
      }
    },
  };
});

vi.mock("@/server/config/paths.server", async () => {
  const real = await vi.importActual<typeof import("@/server/config/paths.server")>(
    "@/server/config/paths.server",
  );
  return { ...real, getProjectWorkspaceRoot: vi.fn() };
});

vi.mock("@/features/agents/codex/validation/typecheck.server", () => ({
  runTypecheck: vi.fn(async () => ({ ok: true, durationMs: 5 })),
  runProcess: vi.fn(),
  countErrors: vi.fn(),
}));

vi.mock("@/features/agents/codex/skills/template-scanner.server", () => ({
  scanActiveTemplates: vi.fn(async () => []),
  aggregateTemplateScans: vi.fn(() => ({
    required: new Set(),
    recommended: new Set(),
  })),
}));


const buildSpy = vi.fn(async () => ({ ok: true, durationMs: 5 }));
vi.mock("@/features/agents/codex/validation/build.server", () => ({
  runBuild: buildSpy,
}));

vi.mock("@/features/agents/codex/validation/preview-health.server", () => ({
  runPreviewHealth: vi.fn(async () => ({
    ok: true,
    pm2: { name: "proj-x", status: "online" },
    rootStatus: 200,
    routes: [],
    optionalFailures: [],
  })),
  CORE_HARD_GATE_ROUTES: ["/", "/products", "/cart", "/checkout"],
}));

let tmpRoot: string;

async function seedDraft(
  draftDirParent: string,
  fileCount: number,
): Promise<void> {
  const dirs = await fs.readdir(draftDirParent);
  const target = path.join(draftDirParent, dirs[0]);
  await fs.mkdir(path.join(target, "src/components"), { recursive: true });
  for (let i = 0; i < fileCount; i++) {
    await fs.writeFile(
      path.join(target, `src/components/Item${i}.tsx`),
      `export const Item${i} = ${i};`,
    );
  }
}

beforeEach(async () => {
  buildSpy.mockClear();
  (globalThis as any).__codexProjectRoot = undefined;
  (globalThis as any).__codexDraftRoot = undefined;
  const { getProjectWorkspaceRoot } = await import(
    "@/server/config/paths.server"
  );
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "small-update-"));
  (getProjectWorkspaceRoot as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (projectId: string) => path.join(tmpRoot, projectId),
  );
});

describe("small update integration", () => {
  it("skips planning milestone and skips build", async () => {
    const { runSmallUpdateBuilderRun, newRunId } = await import(
      "@/features/agents/codex/runtime/builder-run.server"
    );
    const projectId = "proj-1";
    await fs.mkdir(path.join(tmpRoot, projectId, "published"), { recursive: true });

    const env: CodexEnvAvailable = {
      available: true,
      codexHome: path.join(tmpRoot, "codex-home"),
      apiKey: "k",
      model: "m",
      baseUrl: undefined,
      skillsRoot: path.join(tmpRoot, "skills"),
      maxSkillChars: 32000,
      llmTieBreakGap: 10,
      maxSelectedSkills: 3,
    };

    const ctx = {
      projectId,
      userId: "u1",
      runId: newRunId(),
      kind: "update" as const,
      userPrompt: "tweak the hero copy",
      locale: "vi-VN",
      env,
      projectSummary: null,
    };

    const events: any[] = [];
    const seedTimer = setTimeout(() => {
      seedDraft(path.join(tmpRoot, projectId, "drafts"), 3).catch(() => {});
    }, 5);
    const outcome = await runSmallUpdateBuilderRun(ctx, (e) => events.push(e));
    clearTimeout(seedTimer);

    const milestones = events
      .filter((e) => e.type === "milestone")
      .map((e) => e.milestone);
    expect(milestones).not.toContain("planning");
    expect(buildSpy).not.toHaveBeenCalled();
    expect(["done", "failed"]).toContain(outcome.status);
  });

  it("rejects with validation_failed when over the 20-file cap", async () => {
    const { runSmallUpdateBuilderRun, newRunId } = await import(
      "@/features/agents/codex/runtime/builder-run.server"
    );
    const projectId = "proj-2";
    await fs.mkdir(path.join(tmpRoot, projectId, "published"), { recursive: true });

    const env: CodexEnvAvailable = {
      available: true,
      codexHome: path.join(tmpRoot, "codex-home"),
      apiKey: "k",
      model: "m",
      baseUrl: undefined,
      skillsRoot: path.join(tmpRoot, "skills"),
      maxSkillChars: 32000,
      llmTieBreakGap: 10,
      maxSelectedSkills: 3,
    };

    const ctx = {
      projectId,
      userId: "u1",
      runId: newRunId(),
      kind: "update" as const,
      userPrompt: "do a lot",
      locale: "vi-VN",
      env,
      projectSummary: null,
    };

    const events: any[] = [];
    const seedTimer = setTimeout(() => {
      seedDraft(path.join(tmpRoot, projectId, "drafts"), 25).catch(() => {});
    }, 5);
    const outcome = await runSmallUpdateBuilderRun(ctx, (e) => events.push(e));
    clearTimeout(seedTimer);

    expect(outcome.status).toBe("failed");
    expect(outcome.failureCode).toBe("validation_failed");
  });
});
