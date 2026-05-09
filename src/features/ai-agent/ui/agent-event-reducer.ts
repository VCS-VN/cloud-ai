import type { AgentStreamEvent, ValidationResult } from "../agent/agent-events";

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
  done: boolean;
  doneSummary?: string;
  previewUrl?: string;
  error?: Extract<AgentStreamEvent, { type: "error" }>;
};

export function createInitialAgentEventState(): AgentEventState {
  return { events: [], assistantMessage: "", changedFiles: [], done: false };
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
  if (event.type === "validation_finished") next.validation = { ok: event.ok, summary: event.summary, errors: event.errors ?? [] };
  if (event.type === "done") {
    next.done = true;
    next.doneSummary = event.summary;
    next.previewUrl = event.previewUrl;
    next.changedFiles = [...new Set([...next.changedFiles, ...event.changedFiles])];
  }
  if (event.type === "error") next.error = event;
  return next;
}
