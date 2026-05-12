import type { AgentStreamEvent, ValidationResult } from "../agent/agent-events";

export type RuntimeUIState = {
  status: "idle" | "installing" | "installed" | "starting" | "running" | "stopped" | "error" | "fixing";
  previewUrl: string | null;
  previewPort: number | null;
  error: string | null;
  errorTier: "code" | "config" | "system" | null;
  fixAttempt: number | null;
  fixChangedFiles: string[];
  durationMs: number | null;
};

export type AgentEventState = {
  events: AgentStreamEvent[];
  assistantMessage: string;
  thinking?: {
    started: boolean;
    message?: string;
    projectStatus?: string;
    hasInitializedSource?: boolean;
    completed?: Extract<AgentStreamEvent, { type: "thinking_completed" }>;
  };
  clarification?: Extract<AgentStreamEvent, { type: "clarification_required" }>;
  changedFiles: string[];
  validation?: Pick<ValidationResult, "ok" | "summary" | "errors">;
  codeTool?: {
    active: boolean;
    taskTitle?: string;
    lastTool?: string;
    repairAttempt?: number;
    humanReviewReason?: string;
    validationStatus?: "passed" | "failed" | "skipped";
  };
  done: boolean;
  doneSummary?: string;
  previewUrl?: string;
  error?: Extract<AgentStreamEvent, { type: "error" }>;
  runtime: RuntimeUIState;
};

const INITIAL_RUNTIME: RuntimeUIState = {
  status: "idle",
  previewUrl: null,
  previewPort: null,
  error: null,
  errorTier: null,
  fixAttempt: null,
  fixChangedFiles: [],
  durationMs: null,
};

export function createInitialAgentEventState(): AgentEventState {
  return { events: [], assistantMessage: "", changedFiles: [], done: false, runtime: { ...INITIAL_RUNTIME } };
}

export function agentEventReducer(state: AgentEventState, event: AgentStreamEvent): AgentEventState {
  const next: AgentEventState = { ...state, events: [...state.events, event] };
  if (event.type === "assistant_message_delta") next.assistantMessage += event.delta;
  if (event.type === "thinking_started") next.thinking = { ...next.thinking, started: true, message: event.message };
  if (event.type === "thinking_context_loaded") {
    next.thinking = {
      ...next.thinking,
      started: next.thinking?.started ?? false,
      projectStatus: event.projectStatus,
      hasInitializedSource: event.hasInitializedSource,
    };
  }
  if (event.type === "thinking_completed") {
    next.thinking = { ...next.thinking, started: next.thinking?.started ?? false, completed: event };
  }
  if (event.type === "clarification_required") next.clarification = event;
  if (event.type === "file_changed") next.changedFiles = [...new Set([...next.changedFiles, event.path])];
  if (event.type === "validation_finished") next.validation = { ok: event.ok ?? event.status === "passed", summary: event.summary, errors: event.errors ?? [] };
  if (event.type === "code_tool_loop_started") next.codeTool = { ...next.codeTool, active: true, taskTitle: event.taskTitle };
  if (event.type === "tool_call_requested") next.codeTool = { ...next.codeTool, active: true, lastTool: event.toolName };
  if (event.type === "patch_applied") next.changedFiles = [...new Set([...next.changedFiles, ...event.changedFiles])];
  if (event.type === "repair_started") next.codeTool = { ...next.codeTool, active: true, repairAttempt: event.attempt };
  if (event.type === "human_review_required") {
    next.done = true;
    next.codeTool = { ...next.codeTool, active: false, humanReviewReason: event.reason };
    next.changedFiles = [...new Set([...next.changedFiles, ...event.changedFiles])];
  }
  if (event.type === "code_tool_loop_completed") {
    next.done = true;
    next.doneSummary = event.summary;
    next.codeTool = { ...next.codeTool, active: false, validationStatus: event.validationStatus };
    next.changedFiles = [...new Set([...next.changedFiles, ...event.changedFiles])];
  }
  if (event.type === "done") {
    next.done = true;
    next.doneSummary = event.summary;
    next.previewUrl = event.previewUrl;
    next.changedFiles = [...new Set([...next.changedFiles, ...event.changedFiles])];
  }
  if (event.type === "error") next.error = event;
  if (event.type === "dev_install_started") {
    next.runtime = { ...next.runtime, status: "installing", error: null };
  }
  if (event.type === "dev_install_completed") {
    next.runtime = { ...next.runtime, status: "installed", durationMs: event.durationMs };
  }
  if (event.type === "dev_install_failed") {
    next.runtime = { ...next.runtime, status: "error", error: event.error };
  }
  if (event.type === "dev_starting") {
    next.runtime = { ...next.runtime, status: "starting" };
  }
  if (event.type === "dev_ready") {
    next.runtime = { ...next.runtime, status: "running", previewUrl: event.previewUrl, previewPort: event.port };
  }
  if (event.type === "dev_error") {
    next.runtime = { ...next.runtime, status: "error", error: event.error, errorTier: event.tier };
  }
  if (event.type === "dev_fix_attempt") {
    next.runtime = { ...next.runtime, status: "fixing", fixAttempt: event.attempt, error: event.error };
  }
  if (event.type === "dev_fix_applied") {
    next.runtime = { ...next.runtime, fixChangedFiles: event.changedFiles };
  }
  if (event.type === "dev_fix_failed") {
    next.runtime = { ...next.runtime, status: "error", error: event.reason };
  }
  return next;
}
