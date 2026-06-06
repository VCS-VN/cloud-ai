import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import type { CodexEnvAvailable } from "@/server/env/codex";

vi.mock("@openai/codex-sdk", async () => {
  let callCount = 0;
  return {
    Codex: class {
      startThread() {
        return {
          id: "t1",
          async run() {
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
            return { items: [], finalResponse: "ok", usage: null };
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
    if (outcome.status === "done") {
      expect(previewSpy).toHaveBeenCalled();
      const previewArg = (previewSpy.mock.calls[0] as unknown as [{ extraRoutes?: string[] }])[0];
      expect(previewArg.extraRoutes).toContain("/about");
    }
  });
});
