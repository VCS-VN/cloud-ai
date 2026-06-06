export type BuilderRunMilestone =
  | "loading_context"
  | "planning"
  | "creating_draft"
  | "building_pages"
  | "checking_preview"
  | "repairing"
  | "publishing"
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
  | "repair_exhausted";

export type BuilderRunEvent =
  | { type: "milestone"; runId: string; milestone: BuilderRunMilestone; at: number }
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
