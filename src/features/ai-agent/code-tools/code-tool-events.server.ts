import type { AgentStreamEvent } from "../agent/agent-events";
import type { CodeToolCategory, ValidationResult } from "./code-agent-types";
import { sanitizeSummary } from "./services/project-validation-service.server";

export type CodeToolStreamEvent = Extract<AgentStreamEvent, { type: CodeToolEventType }>;
export type CodeToolEventType =
  | "code_tool_loop_started"
  | "code_context_loaded"
  | "tool_call_requested"
  | "tool_call_completed"
  | "snapshot_created"
  | "patch_applied"
  | "validation_started"
  | "validation_finished"
  | "repair_started"
  | "preview_restart_required"
  | "code_tool_loop_completed"
  | "human_review_required";

export function buildCodeToolLoopStartedEvent(input: { projectId: string; messageId: string; taskTitle: string; mode?: string; summary?: string }) {
  return { type: "code_tool_loop_started", projectId: input.projectId, messageId: input.messageId, taskTitle: sanitize(input.taskTitle), mode: input.mode ?? "apply", summary: sanitize(input.summary ?? input.taskTitle), message: "Inspecting current storefront code..." } as const;
}

export function buildToolCallRequestedEvent(input: { projectId: string; messageId: string; toolName: string; category: CodeToolCategory; safeSummary: string }) {
  return { type: "tool_call_requested", projectId: input.projectId, messageId: input.messageId, toolName: input.toolName, category: input.category, safeSummary: sanitize(input.safeSummary) } as const;
}

export function buildCodeContextLoadedEvent(input: { projectId: string; messageId: string; summary: string; stack: string[]; fileCount: number }) {
  return { type: "code_context_loaded", projectId: input.projectId, messageId: input.messageId, summary: sanitize(input.summary), stack: input.stack, fileCount: input.fileCount } as const;
}

export function buildToolCallCompletedEvent(input: { projectId: string; messageId: string; toolName: string; ok: boolean; summary: string; recoverable: boolean }) {
  return { type: "tool_call_completed", projectId: input.projectId, messageId: input.messageId, toolName: input.toolName, ok: input.ok, summary: sanitize(input.summary), recoverable: input.recoverable } as const;
}

export function buildPatchAppliedEvent(input: { projectId: string; messageId: string; changedFiles: string[]; insertions: number; deletions: number }) {
  return { type: "patch_applied", projectId: input.projectId, messageId: input.messageId, changedFiles: input.changedFiles, insertions: input.insertions, deletions: input.deletions } as const;
}

export function buildSnapshotCreatedEvent(input: { projectId: string; messageId: string; snapshotId: string }) {
  return { type: "snapshot_created", projectId: input.projectId, messageId: input.messageId, snapshotId: input.snapshotId } as const;
}

export function buildValidationStartedEvent(input: { projectId: string; messageId: string; commands: string[] }) {
  return { type: "validation_started", projectId: input.projectId, messageId: input.messageId, commands: input.commands } as const;
}

export function buildValidationFinishedEvent(input: { projectId: string; messageId: string; status: ValidationResult["status"]; summary: string }) {
  return { type: "validation_finished", projectId: input.projectId, messageId: input.messageId, status: input.status, summary: sanitize(input.summary) } as const;
}

export function buildRepairStartedEvent(input: { projectId: string; messageId: string; reason: string; attempt: number }) {
  return { type: "repair_started", projectId: input.projectId, messageId: input.messageId, reason: sanitize(input.reason), attempt: input.attempt } as const;
}

export function buildPreviewRestartRequiredEvent(input: { projectId: string; messageId: string; reason: string; changedFiles: string[] }) {
  return { type: "preview_restart_required", projectId: input.projectId, messageId: input.messageId, reason: sanitize(input.reason), changedFiles: input.changedFiles } as const;
}

export function buildCodeToolLoopCompletedEvent(input: { projectId: string; messageId: string; summary: string; changedFiles: string[]; validationStatus: ValidationResult["status"] }) {
  return { type: "code_tool_loop_completed", projectId: input.projectId, messageId: input.messageId, summary: sanitize(input.summary), changedFiles: input.changedFiles, validationStatus: input.validationStatus } as const;
}

export function buildHumanReviewRequiredEvent(input: { projectId: string; messageId: string; reason: string; changedFiles: string[] }) {
  return { type: "human_review_required", projectId: input.projectId, messageId: input.messageId, reason: sanitize(input.reason), changedFiles: input.changedFiles } as const;
}

export function summarizeValidationResult(result: ValidationResult) {
  if (result.status === "passed") return "Validation passed";
  if (result.status === "skipped") return "Validation skipped";
  const failed = result.commands.find((command) => command.status === "failed");
  return failed?.stderrSummary || failed?.stdoutSummary || "Validation failed";
}

function sanitize(value: string) {
  return sanitizeSummary(value, 240);
}
