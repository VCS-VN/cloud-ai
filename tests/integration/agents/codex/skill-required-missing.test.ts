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
      requiredSkills: ["ghost-skill"],
      recommendedSkills: [],
    },
  ]),
  aggregateTemplateScans: vi.fn(() => ({
    required: new Set<string>(["ghost-skill"]),
    recommended: new Set<string>(),
  })),
}));

let tmpRoot: string;
let skillsRoot: string;

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
    path.join(os.tmpdir(), "skill-required-missing-"),
  );
  skillsRoot = path.join(tmpRoot, "skills");
  await fs.mkdir(skillsRoot, { recursive: true });
  // Intentionally empty registry so ghost-skill is missing.
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

describe("US4 required-skill missing fail-fast", () => {
  it("aborts before draft creation when a templateRequired skill is missing from the registry", async () => {
    const { runInitBuilderRun, newRunId } = await import(
      "@/features/agents/codex/runtime/builder-run.server"
    );
    const { createBuilderRunHandle } = await import(
      "@/features/agents/codex/runtime/builder-run-registry.server"
    );

    const projectId = "proj-rm";
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

    const events: Array<{
      type: string;
      milestone?: string;
      failureCode?: string;
      message?: string;
    }> = [];
    const outcome = await runInitBuilderRun(ctx, (e) =>
      events.push(
        e as {
          type: string;
          milestone?: string;
          failureCode?: string;
          message?: string;
        },
      ),
    );

    expect(outcome.status).toBe("failed");
    expect(outcome.failureCode).toBe("required_skill_unavailable");

    const draftsDir = path.join(tmpRoot, projectId, "drafts");
    let entries: string[] = [];
    try {
      entries = await fs.readdir(draftsDir);
    } catch (err) {
      expect((err as NodeJS.ErrnoException).code).toBe("ENOENT");
    }
    expect(entries.length).toBe(0);

    const failedEvent = events.find((e) => e.type === "failed");
    expect(failedEvent).toBeDefined();
    expect(failedEvent?.failureCode).toBe("required_skill_unavailable");
    expect(failedEvent?.message).toContain("ghost-skill");

    // No creating_draft milestone fires.
    const milestones = events
      .filter((e) => e.type === "milestone")
      .map((e) => e.milestone);
    expect(milestones).not.toContain("creating_draft");
  });
});
