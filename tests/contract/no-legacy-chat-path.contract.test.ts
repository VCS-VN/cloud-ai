import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../..");

/**
 * Guard test for the Phase 10 chat-only cleanup.
 *
 * After Phase 10 (scoped chat-only cleanup, decision logged in
 * `specs/027-codex-sdk-chat-migration/tasks.md`), the legacy chat orchestrator
 * path under `src/features/ai-agent/` is gone, but a SHARED tail remains:
 * `agent/agent-events.ts`, `agent/agent-errors.ts`, `agent/agentic-loop.types.ts`,
 * `agent/error-classifier.ts`, `agent/prompt-template-store.server.ts`. Those
 * files are imported by non-chat production code (init backfill, error
 * analyzer, code-tools events). They are explicitly preserved.
 *
 * This guard:
 *  - asserts the deleted chat-orchestrator surface stays deleted
 *  - asserts no new file recreates the legacy chat path
 *  - asserts no import string targets a removed module
 */

const REMOVED_CHAT_FILES = [
  "src/features/ai-agent/agent/agent-orchestrator.server.ts",
  "src/features/ai-agent/agent/agent-runner.server.ts",
  "src/features/ai-agent/agent/agent-event-to-skeleton.ts",
  "src/features/ai-agent/agent/agent-event-to-milestone.ts",
  "src/features/ai-agent/agent/user-facing-presenter.ts",
  "src/features/ai-agent/agent/agentic-loop.server.ts",
  "src/features/ai-agent/agent/agentic-prompts.server.ts",
  "src/features/ai-agent/agent/init-prompt.server.ts",
  "src/features/ai-agent/agent/init-prompt-store.server.ts",
  "src/features/ai-agent/agent/agent-config.ts",
  "src/features/ai-agent/agent/orchestrator-state-machine.ts",
  "src/features/ai-agent/agent/async-event-queue.ts",
  "src/features/ai-agent/agent/context-compaction.ts",
  "src/features/ai-agent/agent/design-variant-generator.ts",
  "src/features/ai-agent/agent/reasoning-effort.ts",
  "src/features/ai-agent/agent/retry.ts",
  "src/features/ai-agent/agent/project-rule-docs.server.ts",
  "src/features/ai-agent/agent/vertical-init-guidance.server.ts",
  "src/features/ai-agent/ui/use-agent-stream.ts",
  "src/features/ai-agent/ui/streaming-text-panel.tsx",
  "src/server/services/message-service.ts",
  "src/server/functions/project-runs.ts",
  "src/routes/api/projects/$projectId/runs/index.ts",
  "src/routes/api/projects/$projectId/runs/$runId/stream.ts",
  "src/routes/api/projects/$projectId/runs/$runId/stop.ts",
  "src/routes/api/projects/$projectId/runs/$runId/retry.ts",
  "src/routes/api/projects/$projectId/runs/$runId/select-option.ts",
];

const REMOVED_DIRS = [
  "src/features/ai-agent/api",
  "src/routes/api/projects/$projectId/runs",
];

// `src/features/ai-agent/thinking/` is preserved with ONLY `thinking.schema.ts`
// because `agent/agentic-loop.types.ts` (load-bearing for non-chat init code)
// transitively imports it. Other thinking files are deleted.
const PRESERVED_THINKING_ALLOWLIST = ["thinking.schema.ts"];

const FORBIDDEN_IMPORT_FRAGMENTS = [
  "@/features/ai-agent/agent/agent-orchestrator.server",
  "@/features/ai-agent/agent/agent-runner.server",
  "@/features/ai-agent/agent/agent-event-to-skeleton",
  "@/features/ai-agent/agent/agent-event-to-milestone",
  "@/features/ai-agent/agent/user-facing-presenter",
  "@/features/ai-agent/agent/agentic-loop.server",
  "@/features/ai-agent/agent/agentic-prompts.server",
  "@/features/ai-agent/agent/init-prompt-store.server",
  "@/features/ai-agent/agent/init-prompt.server",
  "@/features/ai-agent/agent/agent-config",
  "@/features/ai-agent/agent/orchestrator-state-machine",
  "@/features/ai-agent/agent/async-event-queue",
  "@/features/ai-agent/agent/context-compaction",
  "@/features/ai-agent/agent/design-variant-generator",
  "@/features/ai-agent/agent/reasoning-effort",
  "@/features/ai-agent/agent/retry",
  "@/features/ai-agent/agent/project-rule-docs.server",
  "@/features/ai-agent/agent/vertical-init-guidance",
  "@/features/ai-agent/ui/use-agent-stream",
  "@/features/ai-agent/ui/streaming-text-panel",
  "@/features/ai-agent/ui/agent-event-reducer",
  "@/features/ai-agent/ui/preview-availability",
  "@/features/ai-agent/ui/preview-path",
  "@/features/ai-agent/api/",
  "@/features/ai-agent/thinking/",
  "@/server/services/message-service",
  "@/server/functions/project-runs",
];

function walkSource(dir: string, filter: (p: string) => boolean): string[] {
  const out: string[] = [];
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (filter(full)) out.push(full);
    }
  }
  return out;
}

describe("Phase 10 cleanup guard — legacy chat orchestrator stays deleted", () => {
  it("removed files are absent from the working tree", () => {
    const stillPresent = REMOVED_CHAT_FILES.filter((rel) =>
      fs.existsSync(path.join(REPO_ROOT, rel)),
    );
    expect(stillPresent, `expected the following files to remain deleted:\n${stillPresent.join("\n")}`).toEqual([]);
  });

  it("removed directories are absent or empty", () => {
    const violators = REMOVED_DIRS.filter((rel) => {
      const abs = path.join(REPO_ROOT, rel);
      if (!fs.existsSync(abs)) return false;
      try {
        return fs.readdirSync(abs).length > 0;
      } catch {
        return false;
      }
    });
    expect(violators, `expected directories deleted/empty:\n${violators.join("\n")}`).toEqual([]);
  });

  it("ai-agent/thinking/ contains ONLY the preserved schema files", () => {
    const dir = path.join(REPO_ROOT, "src/features/ai-agent/thinking");
    if (!fs.existsSync(dir)) return;
    const remaining = fs.readdirSync(dir).sort();
    expect(remaining).toEqual(PRESERVED_THINKING_ALLOWLIST);
  });

  it("no source file imports a removed module", () => {
    const sources = walkSource(path.join(REPO_ROOT, "src"), (p) => /\.(ts|tsx)$/.test(p));
    const offenders: string[] = [];
    for (const file of sources) {
      const content = fs.readFileSync(file, "utf8");
      for (const fragment of FORBIDDEN_IMPORT_FRAGMENTS) {
        if (content.includes(fragment)) {
          offenders.push(`${path.relative(REPO_ROOT, file)} imports ${fragment}`);
        }
      }
    }
    expect(offenders, `forbidden imports detected:\n${offenders.join("\n")}`).toEqual([]);
  });
});
