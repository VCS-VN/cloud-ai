export type BuilderRunMilestone =
  | "loading_context"
  | "planning"
  | "creating_draft"
  | "building_pages"
  | "checking_preview"
  | "repairing"
  | "publishing"
  | "awaiting_clarification"
  | "done"
  | "failed"
  | "cancelled";

export type BuilderRunFailureCode =
  | "validation_failed"
  | "boundary_violation"
  | "config_unavailable"
  | "cancelled"
  | "preview_failed"
  | "codex_runtime_failed"
  | "blocked_request"
  | "repair_exhausted"
  | "required_skill_unavailable"
  | "skill_unavailable"
  | "provider_drops_reasoning"
  | "interrupted_by_restart";

export type BuilderRunClarificationOption = {
  id: string;
  label: string;
};

export type BuilderRunClarificationMetadata =
  | {
      questionType: "skill_clarification";
      options: BuilderRunClarificationOption[];
      customAnswerAllowed: boolean;
    }
  | {
      questionType: "design_variant";
      options: unknown[];
      customAnswerAllowed: true;
    }
  | {
      questionType: "plan_review";
      planMarkdown: string;
    };

export type BuilderRunTaskPhase = "prep" | "build" | "verify";

export type BuilderRunPlannedTask = {
  id: string;
  title: string;
  phase: BuilderRunTaskPhase;
};

export type BuilderRunEvent =
  | { type: "milestone"; runId: string; milestone: BuilderRunMilestone; at: number }
  | {
      type: "awaiting_clarification";
      runId: string;
      milestone: "awaiting_clarification";
      question: string;
      options: BuilderRunClarificationOption[];
      metadata?: BuilderRunClarificationMetadata;
      at: number;
    }
  | {
      type: "failed";
      runId: string;
      milestone: "failed";
      failureCode: BuilderRunFailureCode;
      message: string;
      at: number;
    }
  | { type: "done"; runId: string; milestone: "done"; at: number }
  | { type: "cancelled"; runId: string; milestone: "cancelled"; at: number }
  | { type: "file_change"; runId: string; path: string; at: number }
  | { type: "thinking"; runId: string; text: string; at: number }
  | { type: "turn_completed"; runId: string; finalResponse: string; at: number }
  | {
      type: "plan.created";
      runId: string;
      tasks: BuilderRunPlannedTask[];
      at: number;
    }
  | { type: "plan.task.started"; runId: string; taskId: string; at: number }
  | { type: "plan.task.completed"; runId: string; taskId: string; at: number }
  | { type: "plan.task.paused"; runId: string; taskId: string; at: number }
  | { type: "plan.task.resumed"; runId: string; taskId: string; at: number }
  | {
      // Ephemeral live-progress signal fired during a streamed codex turn so
      // the UI can show which step is running (vs. a frozen skeleton). The
      // `label` is pre-localized + privacy-safe at the emit site so the
      // translator stays a pure mapping. Maps to a single `skeleton.update`
      // downstream — no persistence, no dedicated message bubble.
      type: "step";
      runId: string;
      kind: "command" | "file_edit" | "mcp_tool";
      label: string;
      status: "in_progress" | "completed" | "failed";
      at: number;
    };
