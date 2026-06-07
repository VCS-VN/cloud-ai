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
      `description: "Skill ${name} for clarification flow test"`,
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
    path.join(os.tmpdir(), "skill-clarification-flow-"),
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

describe("US2 clarification happy-path pause", () => {
  it(
    "pauses with awaiting_clarification, persists pendingSkills, and creates no draft",
    async () => {
      const { runInitBuilderRun, newRunId } = await import(
        "@/features/agents/codex/runtime/builder-run.server"
      );
      const { createBuilderRunHandle, getBuilderRunHandle } = await import(
        "@/features/agents/codex/runtime/builder-run-registry.server"
      );

      const projectId = "proj-cf";
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

      type ProbeEvent = {
        type: string;
        milestone?: string;
        question?: string;
        options?: Array<{ id: string; label: string }>;
      };
      const emitted: ProbeEvent[] = [];
      const outcome = await runInitBuilderRun(ctx, (e) =>
        emitted.push(e as ProbeEvent),
      );

      // (a) outcome paused at awaiting_clarification.
      expect(outcome.status).toBe("awaiting_clarification");

      // (b) awaiting_clarification event was published to the run handle.
      // The runner publishes directly via publishBuilderRunEvent, so we read
      // it from handle.events (mirroring skill-clarification-cancel.test.ts).
      const handle = getBuilderRunHandle(runId);
      expect(handle).toBeDefined();
      const events: ProbeEvent[] = [
        ...emitted,
        ...((handle?.events ?? []) as unknown as ProbeEvent[]),
      ];
      const awaitingEvent = events.find(
        (e) => e.type === "awaiting_clarification",
      );
      expect(awaitingEvent).toBeDefined();

      // (c) event carries non-empty question and >= 2 options shaped {id,label}.
      expect(awaitingEvent?.question).toBeTruthy();
      expect(awaitingEvent?.question?.length ?? 0).toBeGreaterThan(0);
      expect(awaitingEvent?.options?.length ?? 0).toBeGreaterThanOrEqual(2);
      for (const opt of awaitingEvent?.options ?? []) {
        expect(typeof opt.id).toBe("string");
        expect(typeof opt.label).toBe("string");
      }
      const optionIds = (awaitingEvent?.options ?? []).map((o) => o.id);
      expect(optionIds).toEqual(expect.arrayContaining(["a", "b"]));

      // (d) handle.pendingSkills stores both candidates.
      expect(handle?.pendingSkills.length).toBe(2);
      const pendingNames = (handle?.pendingSkills ?? []).map((p) => p.name);
      expect(pendingNames).toEqual(expect.arrayContaining(["a", "b"]));
      for (const p of handle?.pendingSkills ?? []) {
        expect(["a", "b"]).toContain(p.name);
      }

      // (e) clarificationPrompt mirrors the event payload.
      expect(handle?.clarificationPrompt).not.toBeNull();
      expect(handle?.clarificationPrompt?.question).toBe(awaitingEvent?.question);
      expect(handle?.clarificationPrompt?.options.length).toBe(
        awaitingEvent?.options?.length,
      );

      // (f) resumeFn registered for the API answer endpoint.
      expect(typeof handle?.resumeFn).toBe("function");

      // (g) no draft dir created during pause.
      const draftsDir = path.join(tmpRoot, projectId, "drafts");
      let draftEntries: string[] = [];
      try {
        draftEntries = await fs.readdir(draftsDir);
      } catch (err) {
        expect((err as NodeJS.ErrnoException).code).toBe("ENOENT");
      }
      expect(draftEntries.length).toBe(0);

      // Sanity-check resumeFn cleanup invariant. The recursive rerun is hard
      // to model with our mocks, so we only assert pendingSkills/resumeFn are
      // cleared synchronously when resumeFn is invoked. We swallow any
      // downstream rejection from the rerun pass because mocks do not fully
      // simulate it.
      const resume = handle?.resumeFn;
      if (resume) {
        const pendingResume = resume({ optionId: "a" }).catch(() => {
          /* mock-driven rerun may reject; not under test here */
        });
        // The factory clears state before awaiting the rerun, so check now.
        expect(handle?.pendingSkills.length).toBe(0);
        expect(handle?.resumeFn).toBeNull();
        await pendingResume;
      }
    },
  );
});
