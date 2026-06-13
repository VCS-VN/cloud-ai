import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import type { CodexEnvAvailable } from "@/server/env/codex";

// Simulates a provider that STRIPS reasoning.encrypted_content: any thread that
// still requests reasoning (effort !== "minimal") gets an `error` event with the
// canonical `content is required (input[N].content)` rejection — exactly what
// the real provider emitted in production logs. The build-phase fallback then
// re-runs on a fresh thread created with disableReasoning:true, which maps to
// modelReasoningEffort:"minimal"; that thread writes files and completes. This
// proves the fallback actually PRODUCES CODE on a stripping provider, not just
// that the request config is shaped correctly.
const REPLAY_REJECTION =
  '{"error":{"code":"invalid_request_error","message":"content is required (ID: x)","param":"input[3].content","type":"invalid_request_error"}}';

vi.mock("@openai/codex-sdk", () => {
  class FakeThread {
    id: string | null = "thread-1";
    constructor(
      private readonly effort: string | undefined,
      private readonly workdir: string | undefined,
    ) {}
    async run() {
      return { items: [], finalResponse: "ok", usage: null };
    }
    async runStreamed() {
      const effort = this.effort;
      const workdir = this.workdir;
      return {
        events: (async function* () {
          if (effort === "minimal") {
            // Fallback thread (reasoning suppressed): write real files into the
            // draft workspace and complete cleanly.
            if (workdir) {
              await fs.mkdir(path.join(workdir, "src/shared/sample-data"), {
                recursive: true,
              });
              await fs.mkdir(path.join(workdir, "src/components"), {
                recursive: true,
              });
              await fs.writeFile(
                path.join(workdir, "src/shared/sample-data/products.ts"),
                `export const productsListSample = { total: 1, data: [{ id: "p1", store: { slug: "s1" } }] };`,
              );
              await fs.writeFile(
                path.join(workdir, "src/components/SiteHeader.tsx"),
                "export {};",
              );
            }
            yield {
              type: "item.completed",
              item: {
                type: "file_change",
                status: "completed",
                changes: [
                  { path: "src/shared/sample-data/products.ts" },
                  { path: "src/components/SiteHeader.tsx" },
                ],
              },
            };
            yield { type: "turn.completed", usage: null };
            return;
          }
          // Any reasoning-bearing thread is rejected by the stripping provider.
          yield { type: "error", message: REPLAY_REJECTION };
        })(),
      };
    }
  }
  return {
    Codex: class {
      startThread(options: { modelReasoningEffort?: string; workingDirectory?: string }) {
        return new FakeThread(options?.modelReasoningEffort, options?.workingDirectory);
      }
      resumeThread(_id: string, options: { modelReasoningEffort?: string; workingDirectory?: string }) {
        return new FakeThread(options?.modelReasoningEffort, options?.workingDirectory);
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

vi.mock("@/features/agents/codex/validation/typecheck.server", async () => ({
  runTypecheck: vi.fn(async () => ({ ok: true, durationMs: 10 })),
  runProcess: vi.fn(),
  countErrors: vi.fn(),
}));

vi.mock("@/features/agents/codex/validation/build.server", async () => ({
  runBuild: vi.fn(async () => ({ ok: true, durationMs: 10 })),
}));

vi.mock("@/features/agents/codex/validation/preview-health.server", async () => ({
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

beforeEach(async () => {
  const { getProjectWorkspaceRoot } = await import("@/server/config/paths.server");
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "init-fallback-"));
  (getProjectWorkspaceRoot as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (projectId: string) => path.join(tmpRoot, projectId),
  );
});

describe("init build reasoning-replay fallback", () => {
  it("produces code via the no-reasoning fallback when the provider strips encrypted_content", async () => {
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

    // The fallback path must have been taken: the initial reasoning build was
    // rejected with ReasoningReplayError, but the no-reasoning fallback then
    // ran and produced code. The outcome must NOT be the provider_drops_reasoning
    // hard-fail — that would mean the fallback never engaged.
    expect(outcome.failureCode).not.toBe("provider_drops_reasoning");

    // The fallback actually PRODUCED CODE: the diff gate saw the files the
    // no-reasoning fallback thread wrote. changedFiles is the authoritative
    // signal (the build's own snapshot diff), not a guessed filesystem path.
    expect(outcome.changedFiles).toContain("src/shared/sample-data/products.ts");
    expect(outcome.changedFiles).toContain("src/components/SiteHeader.tsx");
  });
});
