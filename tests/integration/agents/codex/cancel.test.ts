import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import type { CodexEnvAvailable } from "@/server/env/codex";

const sleeper = (ms: number) => new Promise((r) => setTimeout(r, ms));

vi.mock("@openai/codex-sdk", async () => ({
  Codex: class {
    startThread() {
      return {
        id: "t1",
        async run(_input: unknown, opts?: { signal?: AbortSignal }) {
          // Honour cancel: throw if the orchestrator has aborted.
          await new Promise<void>((resolve, reject) => {
            const onAbort = () => reject(new Error("aborted"));
            if (opts?.signal?.aborted) return reject(new Error("aborted"));
            opts?.signal?.addEventListener("abort", onAbort, { once: true });
            setTimeout(() => {
              opts?.signal?.removeEventListener("abort", onAbort);
              resolve();
            }, 30);
          });
          return { items: [], finalResponse: "ok", usage: null };
        },
        async runStreamed(_input: unknown, opts?: { signal?: AbortSignal }) {
          // Mirror run()'s cancel semantics: reject the stream when aborted so
          // the streamed bridge surfaces the AbortError the orchestrator
          // listens for.
          await new Promise<void>((resolve, reject) => {
            const onAbort = () => reject(new Error("aborted"));
            if (opts?.signal?.aborted) return reject(new Error("aborted"));
            opts?.signal?.addEventListener("abort", onAbort, { once: true });
            setTimeout(() => {
              opts?.signal?.removeEventListener("abort", onAbort);
              resolve();
            }, 30);
          });
          return {
            events: (async function* () {
              yield { type: "turn.completed", usage: null };
            })(),
          };
        },
      };
    }
  },
}));

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
vi.mock("@/features/agents/codex/validation/typecheck.server", () => ({
  runTypecheck: vi.fn(async () => ({ ok: true, durationMs: 1 })),
  runProcess: vi.fn(),
  countErrors: vi.fn(),
}));
vi.mock("@/features/agents/codex/validation/build.server", () => ({
  runBuild: vi.fn(async () => ({ ok: true, durationMs: 1 })),
}));
vi.mock("@/features/agents/codex/validation/preview-health.server", () => ({
  runPreviewHealth: vi.fn(async () => ({
    ok: true,
    pm2: { status: "online" },
    rootStatus: 200,
    routes: [],
    optionalFailures: [],
  })),
  CORE_HARD_GATE_ROUTES: ["/", "/products", "/cart", "/checkout"],
}));

let tmpRoot: string;

beforeEach(async () => {
  const { getProjectWorkspaceRoot } = await import(
    "@/server/config/paths.server"
  );
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cancel-"));
  (getProjectWorkspaceRoot as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (projectId: string) => path.join(tmpRoot, projectId),
  );
});

describe("cancel mid-run", () => {
  it("aborts active codex turn and marks the run cancelled", async () => {
    const { runSmallUpdateBuilderRun, newRunId } = await import(
      "@/features/agents/codex/runtime/builder-run.server"
    );
    const projectId = "proj-c1";
    await fs.mkdir(path.join(tmpRoot, projectId, "published"), { recursive: true });
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
    const controller = new AbortController();
    const ctx = {
      projectId,
      userId: "u1",
      runId: newRunId(),
      kind: "update" as const,
      userPrompt: "tweak",
      locale: "vi-VN",
      env,
      projectSummary: null,
      signal: controller.signal,
    };
    const events: any[] = [];

    const run = runSmallUpdateBuilderRun(ctx, (e) => events.push(e));
    await sleeper(10);
    controller.abort();
    const outcome = await run;

    expect(outcome.status).toBe("cancelled");
    const cancelEvent = events.find((e) => e.type === "cancelled");
    expect(cancelEvent).toBeDefined();
  });

  it("does NOT promote the published workspace when cancelled", async () => {
    const { runSmallUpdateBuilderRun, newRunId } = await import(
      "@/features/agents/codex/runtime/builder-run.server"
    );
    const projectId = "proj-c2";
    const publishedDir = path.join(tmpRoot, projectId, "published");
    await fs.mkdir(publishedDir, { recursive: true });
    await fs.writeFile(path.join(publishedDir, "marker.txt"), "preserved");

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
    const controller = new AbortController();
    const ctx = {
      projectId,
      userId: "u1",
      runId: newRunId(),
      kind: "update" as const,
      userPrompt: "tweak",
      locale: "vi-VN",
      env,
      projectSummary: null,
      signal: controller.signal,
    };

    const run = runSmallUpdateBuilderRun(ctx, () => {});
    await sleeper(10);
    controller.abort();
    await run;

    const stillThere = await fs.readFile(path.join(publishedDir, "marker.txt"), "utf8");
    expect(stillThere).toBe("preserved");
  });
});
