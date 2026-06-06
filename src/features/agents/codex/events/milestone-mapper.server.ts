import type { BuilderRunEvent, BuilderRunFailureCode, BuilderRunMilestone } from "@/features/agents/ui/builder-events";

export type RawCodexEvent = {
  kind?: string;
  type?: string;
  data?: unknown;
  message?: string;
  path?: string;
};

export type MilestoneEmit = {
  runId: string;
  milestone: BuilderRunMilestone;
  at: number;
};

const PATH_PATTERN = /(\/[A-Za-z0-9._\-/]+|[A-Za-z]:\\[^\s]+)/g;

export function redactPaths(text: string): string {
  return text.replace(PATH_PATTERN, "[path]");
}

const MILESTONE_MAP: Record<string, BuilderRunMilestone> = {
  thread_start: "loading_context",
  context_loaded: "loading_context",
  plan_started: "planning",
  plan_complete: "planning",
  draft_started: "creating_draft",
  draft_writing: "building_pages",
  build_started: "building_pages",
  preview_check: "checking_preview",
  validation_failed: "repairing",
  promote_started: "publishing",
  promote_done: "done",
  cancelled: "cancelled",
};

export function mapCodexEventToMilestone(
  event: RawCodexEvent,
): BuilderRunMilestone | null {
  const key = (event.kind ?? event.type ?? "").toString();
  return MILESTONE_MAP[key] ?? null;
}

export function emitMilestone(input: MilestoneEmit): BuilderRunEvent {
  return {
    type: "milestone",
    runId: input.runId,
    milestone: input.milestone,
    at: input.at,
  };
}

export function emitFailed(input: {
  runId: string;
  failureCode: BuilderRunFailureCode;
  message: string;
  at: number;
}): BuilderRunEvent {
  return {
    type: "failed",
    runId: input.runId,
    milestone: "failed",
    failureCode: input.failureCode,
    message: redactPaths(input.message),
    at: input.at,
  };
}

export function emitDone(runId: string, at: number): BuilderRunEvent {
  return { type: "done", runId, milestone: "done", at };
}

export function emitCancelled(runId: string, at: number): BuilderRunEvent {
  return { type: "cancelled", runId, milestone: "cancelled", at };
}
