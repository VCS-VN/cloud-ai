import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import type { CodexEnvAvailable } from "@/server/env/codex";

vi.mock("@openai/codex-sdk", async () => {
  async function seedFoo(): Promise<void> {
    const root = (globalThis as any).__codexProjectRoot as string | undefined;
    if (!root) return;
    // Update runs in-place against the project root (no draft clone).
    await fs.mkdir(path.join(root, "src/components"), { recursive: true });
    await fs.writeFile(
      path.join(root, "src/components/Foo.tsx"),
      "export const Foo = 1;",
    );
  }
  return {
    Codex: class {
      startThread() {
        return {
          id: "t1",
          async run() {
            await seedFoo();
            return { items: [], finalResponse: "ok", usage: null };
          },
          async runStreamed() {
            await seedFoo();
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
  return { ...real, getProjectWorkspaceRoot: vi.fn() };
});

const typecheckSpy = vi.fn();
vi.mock("@/features/agents/codex/validation/typecheck.server", () => ({
  runTypecheck: typecheckSpy,
  runProcess: vi.fn(),
  countErrors: vi.fn(),
}));

vi.mock("@/features/agents/codex/validation/build.server", () => ({
  runBuild: vi.fn(async () => ({ ok: true, durationMs: 5 })),
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

// The update driver runs the root/style contract before typecheck. Seed the
// runtime-owned plumbing an existing project always has so the run reaches the
// typecheck repair loop this test exercises.
async function seedRootStylePlumbing(projectRoot: string): Promise<void> {
  await fs.mkdir(path.join(projectRoot, "src/routes"), { recursive: true });
  await fs.mkdir(path.join(projectRoot, "src/styles"), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, "src/routes/__root.tsx"),
    [
      "import '@vitejs/plugin-react/preamble';",
      "import '@/styles/app.css';",
      'import { Outlet, Scripts } from "@tanstack/react-router";',
      'import { Providers } from "@/app/providers";',
      "export default function Root() {",
      "  return (<Providers><Outlet /><Scripts /></Providers>);",
      "}",
      "",
    ].join("\n"),
  );
  await fs.writeFile(
    path.join(projectRoot, "src/styles/app.css"),
    [
      "@tailwind base;",
      "@tailwind components;",
      "@tailwind utilities;",
      "/* DESIGN_TOKENS_START */",
      ":root { --primary: 0 0% 0%; }",
      "/* DESIGN_TOKENS_END */",
      "",
    ].join("\n"),
  );
}

beforeEach(async () => {
  typecheckSpy.mockReset();
  (globalThis as any).__codexProjectRoot = undefined;
  const { getProjectWorkspaceRoot } = await import(
    "@/server/config/paths.server"
  );
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repair-"));
  (getProjectWorkspaceRoot as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (projectId: string) => path.join(tmpRoot, projectId),
  );
});

describe("repair cycle", () => {
  it("recovers when typecheck fails once then succeeds", async () => {
    const { runSmallUpdateBuilderRun, newRunId } = await import(
      "@/features/agents/codex/runtime/builder-run.server"
    );
    const projectId = "proj-r1";
    await fs.mkdir(path.join(tmpRoot, projectId, "published"), { recursive: true });
    await seedRootStylePlumbing(path.join(tmpRoot, projectId));
    (globalThis as any).__codexProjectRoot = path.join(tmpRoot, projectId);

    let n = 0;
    typecheckSpy.mockImplementation(async () => {
      n++;
      if (n === 1) return { ok: false, durationMs: 1, summary: "ts error", errorCount: 1 };
      return { ok: true, durationMs: 1 };
    });

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
      userPrompt: "tweak",
      locale: "vi-VN",
      env,
      projectSummary: null,
    };

    const events: any[] = [];
    const outcome = await runSmallUpdateBuilderRun(ctx, (e) => events.push(e));
    expect(outcome.status).toBe("done");
    const milestones = events.filter((e) => e.type === "milestone").map((e) => e.milestone);
    expect(milestones).toContain("repairing");
  });

  it("fails with repair_exhausted after 2 cycles still failing", async () => {
    const { runSmallUpdateBuilderRun, newRunId } = await import(
      "@/features/agents/codex/runtime/builder-run.server"
    );
    const projectId = "proj-r2";
    await fs.mkdir(path.join(tmpRoot, projectId, "published"), { recursive: true });
    await seedRootStylePlumbing(path.join(tmpRoot, projectId));
    (globalThis as any).__codexProjectRoot = path.join(tmpRoot, projectId);

    typecheckSpy.mockResolvedValue({
      ok: false,
      durationMs: 1,
      summary: "ts error",
      errorCount: 1,
    });

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
      userPrompt: "tweak",
      locale: "vi-VN",
      env,
      projectSummary: null,
    };

    const events: any[] = [];
    const outcome = await runSmallUpdateBuilderRun(ctx, (e) => events.push(e));
    expect(outcome.status).toBe("failed");
    expect(outcome.failureCode).toBe("repair_exhausted");
    expect(typecheckSpy).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});
