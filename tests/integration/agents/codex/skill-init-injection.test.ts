import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import type { CodexEnvAvailable } from "@/server/env/codex";

const captured = vi.hoisted(() => ({
  prompts: [] as string[],
  lifecycle: [] as string[],
  selectSkillsCalls: [] as Array<{
    picked: Array<{ name: string; score: number; source: string }>;
    pending: unknown[];
    clarificationRequired: boolean;
  }>,
}));

vi.mock("@openai/codex-sdk", async () => {
  async function writeRequestedFiles(prompt: string) {
    const root = (globalThis as { __codexProjectRoot?: string })
      .__codexProjectRoot;
    if (!root) return;

    const filesMatch = prompt.match(/Files in scope: ([^\n]+)\./);
    if (!filesMatch) return;

    const batchMatch = prompt.match(/Now build batch ([^\s]+) /);
    if (batchMatch) captured.lifecycle.push(`batch:${batchMatch[1]}`);

    const fsM = await import("node:fs/promises");
    const pathM = await import("node:path");
    const files = filesMatch[1]
      .split(",")
      .map((file) => file.trim())
      .filter(Boolean);

    for (const rel of files) {
      if (rel === "src/styles/polish.css") continue;
      const target = pathM.join(root, rel);
      await fsM.mkdir(pathM.dirname(target), { recursive: true });
      const body =
        rel === "DESIGN.md"
          ? "# Design\n\n- Primary: #111111\n- Accent: #f97316\n"
          : rel.endsWith(".tsx")
            ? "export default function MockFile() { return null; }\n"
            : "export {};\n";
      await fsM.writeFile(target, body);
    }
  }

  return {
    Codex: class {
      startThread() {
        return {
          id: "t1",
          async run(prompt: string) {
            captured.prompts.push(prompt);
            return { items: [], finalResponse: "ok", usage: null };
          },
          async runStreamed(prompt: string) {
            captured.prompts.push(prompt);
            await writeRequestedFiles(prompt);
            const finalResponse = prompt.includes("Output JSON only")
              ? JSON.stringify({
                  question: "Chọn hướng style cho store?",
                  variants: [
                    {
                      id: "editorial-retail",
                      label: "Editorial retail",
                      description:
                        "Bố cục editorial sắc nét cho storefront hiện đại.",
                      preview: {
                        font: "Inter",
                        palette: ["#111111", "#f97316", "#f8fafc"],
                        motion: 0.4,
                        density: 0.5,
                      },
                    },
                    {
                      id: "studio-minimal",
                      label: "Studio minimal",
                      description:
                        "Không gian tối giản, nhiều khoảng thở và ảnh sản phẩm lớn.",
                      preview: {
                        font: "Inter",
                        palette: ["#fafafa", "#1f2937", "#22c55e"],
                        motion: 0.2,
                        density: 0.35,
                      },
                    },
                    {
                      id: "market-bold",
                      label: "Market bold",
                      description:
                        "Màu mạnh, nhịp nhanh, hợp catalog khuyến mãi năng động.",
                      preview: {
                        font: "Inter",
                        palette: ["#0f172a", "#eab308", "#ffffff"],
                        motion: 0.7,
                        density: 0.75,
                      },
                    },
                    {
                      id: "premium-calm",
                      label: "Premium calm",
                      description:
                        "Tông trầm cao cấp, tập trung cảm giác tin cậy và tinh gọn.",
                      preview: {
                        font: "Inter",
                        palette: ["#18181b", "#d4af37", "#f4f4f5"],
                        motion: 0.3,
                        density: 0.45,
                      },
                    },
                  ],
                })
              : "ok";
            return {
              events: (async function* () {
                yield {
                  type: "item.completed",
                  item: { type: "agent_message", text: finalResponse },
                };
                yield { type: "turn.completed", usage: null };
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
  runBuild: vi.fn(async () => {
    captured.lifecycle.push("build");
    return { ok: true, durationMs: 5 };
  }),
}));

vi.mock("@/features/agents/codex/validation/root-style-contract.server", () => ({
  runRootStyleContract: vi.fn(async () => ({ ok: true, durationMs: 5 })),
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
    enforceTailwindDirectivesAtTop: vi.fn(async () => false),
  };
});

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
  captured.prompts.length = 0;
  captured.lifecycle.length = 0;
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

      expect(outcome.status).toBe("done");

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

      // Assertion 4: the Codex SDK prompt includes the skill block using the
      // tag that the UI authoring instructions reference.
      const buildPrompt = captured.prompts.find((prompt) =>
        prompt.includes("Skill body for design-taste-frontend."),
      );
      expect(buildPrompt).toBeDefined();
      expect(buildPrompt).toContain(
        `<design_taste_skill name="design-taste-frontend"`,
      );
      expect(buildPrompt).toContain("Skill body for design-taste-frontend.");
      expect(buildPrompt).toContain("</design_taste_skill>");
      expect(buildPrompt).not.toContain(
        `<selected_skill name="design-taste-frontend"`,
      );

      // Assertion 5: init generates all batches before the single build gate.
      expect(captured.lifecycle).toEqual([
        "batch:DESIGN_DOC",
        "batch:COMPONENTS",
        "batch:POLISH",
        "build",
      ]);

      // Assertion 6: registry stored a sha256 hash for the skill.
      const skill = getSkill("design-taste-frontend");
      expect(skill).not.toBeNull();
      expect(skill?.hash).toMatch(/^[a-f0-9]{64}$/);
    },
  );
});
