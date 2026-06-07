import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import type { CodexEnvAvailable } from "@/server/env/codex";

const captured = vi.hoisted(() => ({
  selectSkillsCalls: [] as Array<{
    picked: Array<{ name: string; score: number; source: string }>;
    pending: unknown[];
    clarificationRequired: boolean;
  }>,
}));

vi.mock("@openai/codex-sdk", async () => {
  let callCount = 0;
  return {
    Codex: class {
      startThread() {
        return {
          id: "t1",
          async run() {
            callCount++;
            const fsM = await import("node:fs/promises");
            const pathM = await import("node:path");
            const root = (globalThis as { __codexProjectRoot?: string })
              .__codexProjectRoot;
            if (root) {
              const draftDir = pathM.join(root, "drafts");
              try {
                const dirs = await fsM.readdir(draftDir);
                if (dirs.length > 0 && callCount === 2) {
                  const target = pathM.join(draftDir, dirs[0]);
                  await fsM.mkdir(
                    pathM.join(target, "src/shared/sample-data"),
                    { recursive: true },
                  );
                  await fsM.writeFile(
                    pathM.join(target, "src/shared/sample-data/products.ts"),
                    `export const productsListSample = { total: 1, data: [{ id: "p1", store: { slug: "s1" } }] };`,
                  );
                }
              } catch {
                // ignore
              }
            }
            return { items: [], finalResponse: "ok", usage: null };
          },
          async runStreamed() {
            return {
              events: (async function* () {
                /* empty */
              })(),
            };
          },
        };
      }
      resumeThread() {
        return this.startThread();
      }
    },
  };
});

vi.mock("@/server/config/paths.server", async () => {
  const real = await vi.importActual<
    typeof import("@/server/config/paths.server")
  >("@/server/config/paths.server");
  return { ...real, getProjectWorkspaceRoot: vi.fn() };
});

vi.mock("@/features/agents/codex/validation/typecheck.server", () => ({
  runTypecheck: vi.fn(async () => ({ ok: true, durationMs: 5 })),
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

vi.mock(
  "@/features/agents/codex/validation/product-sample-parser.server",
  () => ({
    parseProductsSample: vi.fn(async () => ({
      ok: true as const,
      productId: "p1",
      storeSlug: "s1",
      total: 1,
      productCount: 1,
      imageViolations: [],
    })),
  }),
);

vi.mock("@/features/agents/codex/skills/template-scanner.server", () => ({
  scanActiveTemplates: vi.fn(async () => [
    {
      templatePath: "/fake/template.md",
      requiredSkills: ["design-taste-frontend"],
      recommendedSkills: [],
    },
  ]),
  aggregateTemplateScans: vi.fn(() => ({
    required: new Set(["design-taste-frontend"]),
    recommended: new Set<string>(),
  })),
}));

vi.mock("@/features/agents/codex/skills/selection.server", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/agents/codex/skills/selection.server")
  >("@/features/agents/codex/skills/selection.server");
  return {
    ...actual,
    selectSkills: async (
      input: Parameters<typeof actual.selectSkills>[0],
    ) => {
      const outcome = await actual.selectSkills(input);
      captured.selectSkillsCalls.push({
        picked: outcome.picked.map((p) => ({
          name: p.name,
          score: p.score,
          source: p.source,
        })),
        pending: outcome.pending,
        clarificationRequired: outcome.clarificationRequired,
      });
      return outcome;
    },
  };
});

let tmpRoot: string;
let skillsRoot: string;

beforeEach(async () => {
  captured.selectSkillsCalls.length = 0;
  const { resetRegistryForTest, loadRegistry } = await import(
    "@/features/agents/codex/skills/registry.server"
  );
  resetRegistryForTest();

  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skill-init-injection-"));
  skillsRoot = path.join(tmpRoot, "skills");
  await fs.mkdir(path.join(skillsRoot, "design-taste-frontend"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(skillsRoot, "design-taste-frontend", "SKILL.md"),
    [
      "---",
      "name: design-taste-frontend",
      'description: "Premium frontend taste skill for landing pages and portfolios"',
      "asksClarification: true",
      "clarificationPolicy: when_ambiguous",
      "---",
      "",
      "Skill body for design-taste-frontend.",
      "",
    ].join("\n"),
  );

  await loadRegistry({ skillsRoot, maxSkillChars: 32000 });

  const { getProjectWorkspaceRoot } = await import(
    "@/server/config/paths.server"
  );
  (
    getProjectWorkspaceRoot as unknown as ReturnType<typeof vi.fn>
  ).mockImplementation((projectId: string) => path.join(tmpRoot, projectId));
});

afterEach(async () => {
  const { resetRegistryForTest } = await import(
    "@/features/agents/codex/skills/registry.server"
  );
  resetRegistryForTest();
  await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
  (globalThis as { __codexProjectRoot?: string }).__codexProjectRoot =
    undefined;
});

describe("US1 skill init injection", () => {
  it(
    "injects template-required skill without clarification and matches registry hash",
    async () => {
      const { runInitBuilderRun, newRunId } = await import(
        "@/features/agents/codex/runtime/builder-run.server"
      );
      const { getSkill } = await import(
        "@/features/agents/codex/skills/registry.server"
      );

      const projectId = "proj-xx";
      const projectDir = path.join(tmpRoot, projectId);
      await fs.mkdir(path.join(projectDir, "published"), { recursive: true });
      (globalThis as { __codexProjectRoot?: string }).__codexProjectRoot =
        projectDir;

      const env: CodexEnvAvailable = {
        available: true,
        codexHome: path.join(tmpRoot, "codex-home"),
        apiKey: "k",
        model: "gpt-5",
        baseUrl: undefined,
        skillsRoot,
        maxSkillChars: 32000,
        llmTieBreakGap: 10,
        maxSelectedSkills: 3,
      };

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

      const events: Array<{ type: string; milestone?: string }> = [];
      const outcome = await runInitBuilderRun(ctx, (e) =>
        events.push(e as { type: string; milestone?: string }),
      );

      // Run completes (status terminal — done or failed both acceptable;
      // the goal is that selection ran and skills were injected).
      expect(["done", "failed"]).toContain(outcome.status);

      // Assertion 2: no awaiting_clarification milestone fired.
      const milestoneNames = events
        .filter(
          (e) => e.type === "milestone" || e.type === "awaiting_clarification",
        )
        .map((e) => e.milestone);
      expect(milestoneNames).not.toContain("awaiting_clarification");

      // Assertion 3: selectSkills picked design-taste-frontend with the
      // expected source/score.
      expect(captured.selectSkillsCalls.length).toBeGreaterThan(0);
      const sel = captured.selectSkillsCalls[0];
      expect(sel.clarificationRequired).toBe(false);
      expect(sel.picked).toHaveLength(1);
      expect(sel.picked[0].name).toBe("design-taste-frontend");
      expect(sel.picked[0].source).toBe("template_required");
      expect(sel.picked[0].score).toBe(100);

      // Assertion 4: registry stored a sha256 hash for the skill.
      const skill = getSkill("design-taste-frontend");
      expect(skill).not.toBeNull();
      expect(skill?.hash).toMatch(/^[a-f0-9]{64}$/);
    },
  );
});
