import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import type { CodexEnvAvailable } from "@/server/env/codex";

vi.mock("@openai/codex-sdk", async () => {
  // The read-only triage turns (classifier, planner, scope-analysis) all call
  // run(); the mutation turn is the ONLY caller of runStreamed(). Key the file
  // write off the first runStreamed() call rather than a shared turn counter so
  // the mock stays correct no matter how many triage turns precede it.
  let mutated = false;
  async function writeRoute(): Promise<void> {
    if (mutated) return;
    mutated = true;
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const root = (globalThis as any).__codexProjectRoot as string;
    await fs.mkdir(path.join(root, "src/routes"), { recursive: true });
    await fs.writeFile(
      path.join(root, "src/routes/about.tsx"),
      "export const About = () => null;",
    );
  }
  return {
    Codex: class {
      startThread() {
        return {
          id: "t1",
          async run() {
            // Read-only triage turn: no edits.
            return { items: [], finalResponse: "ok", usage: null };
          },
          async runStreamed() {
            await writeRoute();
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
      "  return (",
      "    <Providers>",
      "      <Outlet />",
      "      <Scripts />",
      "    </Providers>",
      "  );",
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

describe("new-route builder run", () => {
  it("emits planning milestone, runs build, and forwards new route to preview-health", async () => {
    const { runNewRouteBuilderRun, newRunId } = await import(
      "@/features/agents/codex/runtime/builder-run.server"
    );
    const projectId = "proj-r";
    const projectRoot = path.join(tmpRoot, projectId);
    await fs.mkdir(projectRoot, { recursive: true });
    // Seed the runtime-owned plumbing the root/style contract requires so the
    // run reaches the build gate (an existing project always has these).
    await seedRootStylePlumbing(projectRoot);
    (globalThis as any).__codexProjectRoot = projectRoot;

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
