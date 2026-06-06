export type BuilderRunKind = "init" | "update" | "new_route" | "repair";

export type BuilderRunStatus =
  | "queued"
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

export const TERMINAL_BUILDER_RUN_STATUSES: BuilderRunStatus[] = [
  "done",
  "failed",
  "cancelled",
];

export function isTerminalBuilderRunStatus(status: BuilderRunStatus): boolean {
  return TERMINAL_BUILDER_RUN_STATUSES.includes(status);
}
