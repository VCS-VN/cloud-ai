import type { AgentStreamEvent, ValidationResult } from "../agent/agent-events";

export type AgentEventState = {
  events: AgentStreamEvent[];
  assistantMessage: string;
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
