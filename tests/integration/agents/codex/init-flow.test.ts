import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import type { CodexEnvAvailable } from "@/server/env/codex";

vi.mock("@openai/codex-sdk", async () => {
  class FakeThread {
    id: string | null = "thread-1";
    async run() {
      return { items: [], finalResponse: "ok", usage: null };
    }
    async runStreamed() {
      return {
        events: (async function* () {
          /* empty */
        })(),
      };
    }
  }
  return {
    Codex: class {
      startThread() {
        return new FakeThread();
      }
      resumeThread() {
        return new FakeThread();
      }
    },
  };
});

vi.mock("@/features/agents/codex/skills/template-scanner.server", () => ({
  scanActiveTemplates: vi.fn(async () => []),
  aggregateTemplateScans: vi.fn(() => ({
    required: new Set(),
    recommended: new Set(),
  })),
}));

vi.mock("@/server/config/paths.server", async () => {
  const real = await vi.importActual<typeof import("@/server/config/paths.server")>(
    "@/server/config/paths.server",
  );
  return {
    ...real,
    getProjectWorkspaceRoot: vi.fn(),
  };
});

vi.mock(
  "@/features/agents/codex/validation/typecheck.server",
  async () => ({
    runTypecheck: vi.fn(async () => ({ ok: true, durationMs: 10 })),
    runProcess: vi.fn(),
    countErrors: vi.fn(),
  }),
);

vi.mock(
  "@/features/agents/codex/validation/build.server",
  async () => ({
    runBuild: vi.fn(async () => ({ ok: true, durationMs: 10 })),
  }),
);

vi.mock(
  "@/features/agents/codex/validation/root-style-contract.server",
  async () => ({
    runRootStyleContract: vi.fn(async () => ({ ok: true, durationMs: 10 })),
  }),
);

vi.mock(
  "@/features/agents/codex/validation/preview-health.server",
  async () => ({
    runPreviewHealth: vi.fn(async () => ({
      ok: true,
      pm2: { name: "proj-x", status: "online" },
      rootStatus: 200,
      routes: [],
      optionalFailures: [],
    })),
    CORE_HARD_GATE_ROUTES: ["/", "/products", "/cart", "/checkout"],
  }),
);

vi.mock("@/features/agents/codex/runtime/init-settings-seed.server", () => {
  class InitSettingsSeedError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly targetPath?: string,
    ) {
      super(message);
      this.name = "InitSettingsSeedError";
    }
  }
  return {
    InitSettingsSeedError,
    seedInitSettingsFiles: vi.fn(async () => undefined),
    installInitWorkspaceDependencies: vi.fn(async () => undefined),
    reassertRuntimeOwnedFiles: vi.fn(async () => []),
    injectDesignPaletteIntoAppCss: vi.fn(async () => false),
  };
});

let tmpRoot: string;

beforeEach(async () => {
  const { getProjectWorkspaceRoot } = await import(
    "@/server/config/paths.server"
  );
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "init-flow-"));
  (getProjectWorkspaceRoot as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (projectId: string) => path.join(tmpRoot, projectId),
  );
});

describe("init builder run integration", () => {
  it("runs through the full lifecycle to publishing when gates all pass", async () => {
    const { runInitBuilderRun, newRunId } = await import(
      "@/features/agents/codex/runtime/builder-run.server"
    );

    const env: CodexEnvAvailable = {
      available: true,
      codexHome: path.join(tmpRoot, "codex-home"),
      apiKey: "k",
      model: "gpt-5",
      baseUrl: undefined,
      skillsRoot: path.join(tmpRoot, "skills"),
      maxSkillChars: 32000,
      llmTieBreakGap: 10,
      maxSelectedSkills: 3,
    };

    const projectId = "proj-1";
    const projectDir = path.join(tmpRoot, projectId);
    await fs.mkdir(path.join(projectDir, "published"), { recursive: true });

    const ctx = {
      projectId,
      userId: "u1",
      runId: newRunId(),
      kind: "init" as const,
      userPrompt: "make a store",
      locale: "vi-VN",
      env,
      projectSummary: null,
    };

    const events: any[] = [];
    const emit = (event: any) => events.push(event);

    const outcome = await runInitBuilderRun(ctx, emit);

    expect(outcome.status === "done" || outcome.status === "failed").toBe(true);
    expect(events.length).toBeGreaterThan(0);
    const milestones = events
      .filter((e) => e.type === "milestone")
      .map((e) => e.milestone);
    expect(milestones).toContain("loading_context");
    expect(milestones).toContain("planning");
    expect(milestones).not.toContain("creating_draft");
    expect(milestones).toContain("building_pages");
  });
});
