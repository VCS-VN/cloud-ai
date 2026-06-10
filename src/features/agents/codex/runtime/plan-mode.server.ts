import path from "node:path";
import fs from "node:fs/promises";
import {
  takeSnapshot,
  diffSnapshots,
} from "@/features/agents/codex/boundary/filesystem-audit.server";
import {
  createBoundedCodexThread,
  type BoundedCodexThread,
} from "./codex-thread.server";
import {
  getBuilderRunHandle,
  publishBuilderRunEvent,
  type BuilderRunHandle,
} from "./builder-run-registry.server";
import type { BuilderRunContext } from "./builder-run.server";
import type {
  AgentRunPlanPhase,
  AgentRunClarificationSnapshot,
} from "@/features/projects/legacy/project-state.schema";
import type { PgAgentRunRepository } from "@/server/repositories/agent-run-repository";

const PLAN_PROMPT_TEMPLATE = `You are in PLAN MODE.

Hard rules:
- Do NOT modify files.
- Do NOT create files.
- Do NOT delete files.
- Do NOT run commands that write to disk.
- You may inspect/read files only.
- Your output must be a plan, not an implementation.
- Do not include full code patches unless explicitly asked.

Task:
{task}

Return exactly this structure:

## Understanding
## Findings
## Proposed Plan
## Files To Change
## Risks / Edge Cases
## Validation Plan
## Questions
`;

export function buildPlanModePrompt(task: string): string {
  return PLAN_PROMPT_TEMPLATE.replace("{task}", task);
}

export type PlanTurnDeps = {
  draftWorkspacePath: string;
  agentRunRepository?: PgAgentRunRepository;
};

export type PlanTurnResult =
  | { ok: true; planMarkdown: string; planThreadId: string }
  | { ok: false; reason: "blocked_request" | "codex_runtime_failed"; message: string };

/**
 * Phase 3 plan turn (R2/R3). Runs in a fresh codex thread with sandbox=read-only.
 * Verifies zero workspace mutation by snapshot diff before/after.
 */
export async function runPlanTurn(
  ctx: BuilderRunContext,
  deps: PlanTurnDeps,
): Promise<PlanTurnResult> {
  const before = await takeSnapshot(deps.draftWorkspacePath);
  let thread: BoundedCodexThread;
  try {
    thread = createBoundedCodexThread({
      env: ctx.env,
      draftWorkspacePath: deps.draftWorkspacePath,
      sandboxMode: "read-only",
      modelReasoningEffort: "xhigh",
    });
  } catch (error) {
    return {
      ok: false,
      reason: "codex_runtime_failed",
      message: error instanceof Error ? error.message : "failed to start plan thread",
    };
  }
  let summary;
  try {
    summary = await thread.runTurn({
      prompt: buildPlanModePrompt(ctx.userPrompt),
      signal: ctx.signal,
    });
  } catch (error) {
    return {
      ok: false,
      reason: "codex_runtime_failed",
      message: error instanceof Error ? error.message : "plan turn failed",
    };
  }

  // Audit gate: even though sandbox is read-only, verify no file_change item
  // was emitted and no workspace diff occurred. Either signal is a hard
  // privacy/safety failure for plan mode (FR-013, SC-006).
  if (summary.fileChanges.length > 0) {
    return {
      ok: false,
      reason: "blocked_request",
      message: "plan turn produced file_change items",
    };
  }
  const after = await takeSnapshot(deps.draftWorkspacePath);
  const diff = diffSnapshots(before, after);
  if (diff.added.length > 0 || diff.modified.length > 0 || diff.removed.length > 0) {
    return {
      ok: false,
      reason: "blocked_request",
      message: "plan turn mutated the workspace",
    };
  }

  const planMarkdown = summary.finalResponse.trim();
  const planThreadId = thread.threadId ?? "";
  if (deps.agentRunRepository) {
    const planPhase: AgentRunPlanPhase = {
      stage: "plan_ready",
      planMarkdown,
      planTurnDoneAt: Date.now(),
      planThreadId,
    };
    await deps.agentRunRepository.setPlanPhase(ctx.runId, planPhase).catch(() => undefined);
    const snapshot: AgentRunClarificationSnapshot = {
      questionType: "plan_review",
      planMarkdown,
      selectedAction: null,
      originalRunPrompt: ctx.userPrompt,
    };
    await deps.agentRunRepository
      .setClarificationSnapshot(ctx.runId, snapshot)
      .catch(() => undefined);
  }

  // Publish awaiting_clarification on the handle so the SSE consumer surfaces
  // the plan_review UI.
  const handle = getBuilderRunHandle(ctx.runId);
  if (handle) {
    publishBuilderRunEvent(handle, {
      type: "awaiting_clarification",
      runId: ctx.runId,
      milestone: "awaiting_clarification",
      question: "Would you like to continue with this plan?",
      options: [
        { id: "approve", label: "Approve" },
        { id: "reject", label: "Reject" },
      ],
      metadata: { questionType: "plan_review", planMarkdown },
      at: Date.now(),
    });
  }

  return { ok: true, planMarkdown, planThreadId };
}

export type PlanResolution = "approve" | "reject";

export type PlanResolutionDeps = {
  agentRunRepository?: PgAgentRunRepository;
};

export async function resolvePlan(
  ctx: BuilderRunContext,
  resolution: PlanResolution,
  planMarkdown: string,
  deps: PlanResolutionDeps,
): Promise<void> {
  if (!deps.agentRunRepository) return;
  if (resolution === "reject") {
    await deps.agentRunRepository
      .setPlanPhase(ctx.runId, {
        stage: "plan_rejected",
        planMarkdown,
        rejectedAt: Date.now(),
      })
      .catch(() => undefined);
    await deps.agentRunRepository
      .setClarificationSnapshot(ctx.runId, null)
      .catch(() => undefined);
    return;
  }
  await deps.agentRunRepository
    .setPlanPhase(ctx.runId, {
      stage: "executing",
      planMarkdown,
      executeThreadId: "",
      approvedAt: Date.now(),
    })
    .catch(() => undefined);
}

export function buildExecuteTurnPrompt(originalTask: string, planMarkdown: string): string {
  return `Original task: ${originalTask}\n\nApproved plan:\n${planMarkdown}\n\nExecute the plan now.`;
}
