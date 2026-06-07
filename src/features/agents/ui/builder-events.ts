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
  | "skill_unavailable";

export type BuilderRunClarificationOption = {
  id: string;
  label: string;
};

export type BuilderRunEvent =
  | { type: "milestone"; runId: string; milestone: BuilderRunMilestone; at: number }
  | {
      type: "awaiting_clarification";
      runId: string;
      milestone: "awaiting_clarification";
      question: string;
      options: BuilderRunClarificationOption[];
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
  | { type: "cancelled"; runId: string; milestone: "cancelled"; at: number };
