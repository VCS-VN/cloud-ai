import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import type { CodexEnvAvailable } from "@/server/env/codex";

vi.mock("@openai/codex-sdk", async () => {
  let callCount = 0;
  // Shared turn logic: turn 1 is planning (discovers draft root, no edits),
  // turn 2 is the mutation that writes the new route file. The bridge now
  // streams turns, so this runs from runStreamed; run() delegates for the
  // non-streaming callers (repair loop, classifier).
  async function doTurn(): Promise<void> {
    callCount++;
    const draftRoot = (globalThis as any).__codexDraftRoot as string | undefined;
    if (callCount === 2 && draftRoot) {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      await fs.mkdir(path.join(draftRoot, "src/routes"), { recursive: true });
      await fs.writeFile(
        path.join(draftRoot, "src/routes/about.tsx"),
        "export const About = () => null;",
      );
    }
    if (!draftRoot) {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const root = (globalThis as any).__codexProjectRoot as string;
      const draftDir = path.join(root, "drafts");
      const dirs = await fs.readdir(draftDir);
      if (dirs.length > 0) {
        (globalThis as any).__codexDraftRoot = path.join(draftDir, dirs[0]);
      }
    }
  }
  return {
    Codex: class {
      startThread() {
        return {
          id: "t1",
          async run() {
            await doTurn();
            return { items: [], finalResponse: "ok", usage: null };
          },
          async runStreamed() {
            await doTurn();
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

const previewSpy = vi.fn(async () => ({
  ok: true,
  pm2: { name: "proj-x", status: "online" },
  rootStatus: 200,
  routes: [],
  optionalFailures: [],
}));
vi.mock("@/features/agents/codex/validation/preview-health.server", () => ({
  runPreviewHealth: previewSpy,
  CORE_HARD_GATE_ROUTES: ["/", "/products", "/cart", "/checkout"],
}));

let tmpRoot: string;

beforeEach(async () => {
  buildSpy.mockClear();
  previewSpy.mockClear();
  const { getProjectWorkspaceRoot } = await import(
    "@/server/config/paths.server"
  );
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "new-route-"));
  (getProjectWorkspaceRoot as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (projectId: string) => path.join(tmpRoot, projectId),
  );
});

describe("new-route builder run", () => {
  it("emits planning milestone, runs build, and forwards new route to preview-health", async () => {
    const { runNewRouteBuilderRun, newRunId } = await import(
      "@/features/agents/codex/runtime/builder-run.server"
    );
    const projectId = "proj-r";
    await fs.mkdir(path.join(tmpRoot, projectId, "published"), { recursive: true });
    (globalThis as any).__codexDraftRoot = undefined;
    (globalThis as any).__codexProjectRoot = path.join(tmpRoot, projectId);

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
      kind: "new_route" as const,
      userPrompt: "Add an /about page",
      locale: "vi-VN",
      env,
      projectSummary: null,
    };

    const events: any[] = [];
    const outcome = await runNewRouteBuilderRun(ctx, (e) => events.push(e));

    const milestones = events
      .filter((e) => e.type === "milestone")
      .map((e) => e.milestone);
    expect(milestones).toContain("planning");
    expect(buildSpy).toHaveBeenCalled();
    // Preview health is no longer probed pre-publish (builder-run.server.ts
    // dropped the gate because pm2 hasn't started yet — preview health
    // runs downstream once the runtime orchestrator brings pm2 up).
    expect(previewSpy).not.toHaveBeenCalled();
    expect(outcome.status).toBe("done");
  });
});
