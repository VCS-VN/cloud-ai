export type {
  AgentRun,
  AgentRunStatus,
  BuilderIntent,
  ChangePlan,
  ClarificationEventMetadata,
  ClarificationOption,
  DevRuntime,
  DevRuntimeStatus,
  FileOperation,
  PatchResult,
  ProjectSnapshot,
  ProjectState,
  ProjectStateStatus,
  ValidationResult,
  WebsiteSpec,
} from "../project/project-state.schema";

import type { AgentStreamEvent as BaseAgentStreamEvent } from "../project/project-state.schema";
import type { DevRuntimeEvent } from "../runtime/runtime-events";

export type CodeToolAgentStreamEvent =
  | { type: "code_tool_loop_started"; projectId: string; messageId: string; taskTitle: string; message?: string }
  | { type: "code_context_loaded"; projectId: string; messageId: string; summary: string; stack: string[]; fileCount: number }
  | { type: "tool_call_requested"; projectId: string; messageId: string; toolName: string; category: string; safeSummary: string }
  | { type: "tool_call_completed"; projectId: string; messageId: string; toolName: string; ok: boolean; summary: string; recoverable: boolean }
  | { type: "tool_progress"; projectId: string; messageId: string; toolName: string; status: "running" | "completed" | "failed"; startedAt?: string; durationMs?: number; error?: string }
  | { type: "tool_stdout"; projectId: string; messageId: string; toolName: string; line: string }
  | { type: "snapshot_created"; projectId: string; messageId: string; snapshotId: string }
  | { type: "patch_applied"; projectId: string; messageId: string; changedFiles: string[]; insertions: number; deletions: number }
  | { type: "validation_started"; projectId: string; messageId: string; commands: string[] }
  | { type: "validation_finished"; projectId: string; messageId: string; status: "passed" | "failed" | "skipped"; ok?: boolean; summary: string; errors?: string[] }
  | { type: "repair_started"; projectId: string; messageId: string; reason: string; attempt: number }
  | { type: "preview_restart_required"; projectId: string; messageId: string; reason: string; changedFiles: string[] }
  | { type: "code_tool_loop_completed"; projectId: string; messageId: string; summary: string; changedFiles: string[]; validationStatus: "passed" | "failed" | "skipped" }
  | { type: "human_review_required"; projectId: string; messageId: string; reason: string; changedFiles: string[] };

export type AgentStreamEvent = BaseAgentStreamEvent | CodeToolAgentStreamEvent | DevRuntimeEvent;
