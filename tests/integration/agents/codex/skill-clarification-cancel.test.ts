import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import type { CodexEnvAvailable } from "@/server/env/codex";

vi.mock("@openai/codex-sdk", () => ({
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
}));

vi.mock("@/server/config/paths.server", async () => {
  const real = await vi.importActual<
    typeof import("@/server/config/paths.server")
  >("@/server/config/paths.server");
  return { ...real, getProjectWorkspaceRoot: vi.fn() };
});

vi.mock("@/features/agents/codex/skills/template-scanner.server", () => ({
  scanActiveTemplates: vi.fn(async () => [
    {
      templatePath: "/fake/template.md",
      requiredSkills: [],
      recommendedSkills: ["a", "b"],
    },
  ]),
  aggregateTemplateScans: vi.fn(() => ({
    required: new Set<string>(),
    recommended: new Set<string>(["a", "b"]),
  })),
}));

vi.mock("@/features/agents/codex/skills/tie-break.server", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/agents/codex/skills/tie-break.server")
  >("@/features/agents/codex/skills/tie-break.server");
  return {
    ...actual,
    runTieBreak: vi.fn(async () => ({
      ok: true as const,
      ambiguous: true as const,
      confidence: 0.95,
      reason: "tie",
    })),
  };
});

let tmpRoot: string;
let skillsRoot: string;

async function writeSkill(name: string): Promise<void> {
  await fs.mkdir(path.join(skillsRoot, name), { recursive: true });
  await fs.writeFile(
    path.join(skillsRoot, name, "SKILL.md"),
    [
      "---",
      `name: ${name}`,
      `description: "Skill ${name} for clarification cancel test"`,
      "asksClarification: true",
      "clarificationPolicy: when_ambiguous",
      "---",
      "",
      `Body for skill ${name}.`,
      "",
    ].join("\n"),
  );
}

beforeEach(async () => {
  const { resetRegistryForTest, loadRegistry } = await import(
    "@/features/agents/codex/skills/registry.server"
  );
  const { resetBuilderRunRegistryForTest } = await import(
    "@/features/agents/codex/runtime/builder-run-registry.server"
  );
  resetRegistryForTest();
  resetBuilderRunRegistryForTest();

  tmpRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skill-clarification-cancel-"),
  );
  skillsRoot = path.join(tmpRoot, "skills");
  await fs.mkdir(skillsRoot, { recursive: true });
  await writeSkill("a");
  await writeSkill("b");
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
  const { resetBuilderRunRegistryForTest } = await import(
    "@/features/agents/codex/runtime/builder-run-registry.server"
  );
  resetRegistryForTest();
  resetBuilderRunRegistryForTest();
  await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
});

describe("US2 clarification cancel path", () => {
  it(
    "cancels a paused run, retains pendingSkills, leaves no draft on disk",
    async () => {
      const { runInitBuilderRun, newRunId } = await import(
        "@/features/agents/codex/runtime/builder-run.server"
      );
      const {
        createBuilderRunHandle,
        getBuilderRunHandle,
      } = await import(
        "@/features/agents/codex/runtime/builder-run-registry.server"
      );
      const { cancelBuilderRun } = await import(
        "@/features/agents/codex/runtime/cancel-controller.server"
      );

      const projectId = "proj-cc";
      const userId = "u1";
      const runId = newRunId();
      createBuilderRunHandle({ runId, projectId, userId });

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
        userId,
        runId,
        kind: "init" as const,
        userPrompt: "build storefront",
        locale: "vi-VN",
        env,
        projectSummary: null,
      };

      const events: Array<{ type: string; milestone?: string }> = [];
      const outcome = await runInitBuilderRun(ctx, (e) =>
        events.push(e as { type: string; milestone?: string }),
      );

      expect(outcome.status).toBe("awaiting_clarification");

      const handle = getBuilderRunHandle(runId);
      expect(handle).toBeDefined();
      const awaitingEvent = handle?.events.find(
        (e) => e.type === "awaiting_clarification",
      );
      expect(awaitingEvent).toBeDefined();

      expect(handle?.pendingSkills.length).toBe(2);
      expect(handle?.clarificationPrompt).not.toBeNull();

      const draftsDir = path.join(tmpRoot, projectId, "drafts");
      let preDraftEntries: string[] = [];
      try {
        preDraftEntries = await fs.readdir(draftsDir);
      } catch (err) {
        expect((err as NodeJS.ErrnoException).code).toBe("ENOENT");
      }
      expect(preDraftEntries.length).toBe(0);

      const cancelResult = cancelBuilderRun({ runId, userId });
      expect(cancelResult).toEqual({ ok: true });

      const handleAfter = getBuilderRunHandle(runId);
      expect(handleAfter?.status).toBe("cancelled");
      const cancelledEvent = handleAfter?.events.find(
        (e) => e.type === "cancelled",
      );
      expect(cancelledEvent).toBeDefined();

      // FR-022: pendingSkills retained for audit on cancel.
      expect(handleAfter?.pendingSkills.length).toBe(2);

      let postDraftEntries: string[] = [];
      try {
        postDraftEntries = await fs.readdir(draftsDir);
      } catch (err) {
        expect((err as NodeJS.ErrnoException).code).toBe("ENOENT");
      }
      expect(postDraftEntries.length).toBe(0);
    },
  );
});
