import { CheckCircle2, CircleDashed, FileText, Loader2, TriangleAlert } from "lucide-react";
import type { AgentStreamEvent } from "../agent/agent-events";

const EVENT_LABELS: Record<AgentStreamEvent["type"], string> = {
  agent_started: "Agent started",
  state_loaded: "Project state loaded",
  thinking_started: "Understanding request",
  thinking_context_loaded: "Thinking context loaded",
  user_wish_extracted: "User wishes extracted",
  thinking_needs_clarification: "Clarification required",
  thinking_completed: "Thinking completed",
  intent_detected: "Intent detected",
  clarification_required: "Clarification required",
  context_retrieved: "Context retrieved",
  plan_created: "Plan created",
  source_generation_started: "Generating source",
  assistant_message_delta: "Assistant message",
  file_changed: "File changed",
  validation_started: "Validation started",
  validation_finished: "Validation finished",
  project_state_updated: "Project state updated",
  done: "Done",
  error: "Error",
};

export function AgentEventTimeline({ events }: { events: AgentStreamEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section className="space-y-xs rounded-md border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-sm text-[12px] text-[var(--app-panel-text)] transition-colors duration-200" aria-label="Agent progress timeline" aria-live="polite">
      {events.filter((event) => event.type !== "assistant_message_delta").map((event, index) => (
        <div key={`${event.type}-${index}`} className={`flex gap-xs rounded-sm px-xxs py-xxs transition-colors duration-200 hover:bg-[var(--app-control)] ${(event.type === "clarification_required" || event.type === "thinking_needs_clarification") ? "border border-[var(--app-border)] bg-[var(--app-control)]" : ""}`} role={(event.type === "clarification_required" || event.type === "thinking_needs_clarification") ? "status" : undefined}>
          <span className="mt-[2px] text-[var(--app-icon-muted)]">{iconFor(event)}</span>
          <div className="min-w-0 flex-1">
            <p className="m-0 font-[520] leading-4">{EVENT_LABELS[event.type]}</p>
            <p className="m-0 truncate leading-4 text-[var(--app-muted)]">{detailFor(event)}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

function iconFor(event: AgentStreamEvent) {
  if ((event.type === "clarification_required" || event.type === "thinking_needs_clarification")) return <TriangleAlert aria-hidden="true" size={14} className="text-[var(--app-icon-selected)]" />;
  if (event.type === "error") return <TriangleAlert aria-hidden="true" size={14} className="text-[var(--app-icon)]" />;
  if (event.type === "done" || event.type === "validation_finished" || event.type === "project_state_updated" || event.type === "thinking_completed") return <CheckCircle2 aria-hidden="true" size={14} className="text-[var(--app-icon-selected)]" />;
  if (event.type === "file_changed") return <FileText aria-hidden="true" size={14} className="text-[var(--app-icon-muted)]" />;
  if (event.type === "source_generation_started" || event.type === "validation_started" || event.type === "thinking_started") return <Loader2 aria-hidden="true" size={14} className="animate-spin text-[var(--app-icon-muted)]" />;
  return <CircleDashed aria-hidden="true" size={14} className="text-[var(--app-icon-subtle)]" />;
}

function detailFor(event: AgentStreamEvent) {
  switch (event.type) {
    case "agent_started": return event.message;
    case "state_loaded": return event.status;
    case "thinking_started": return event.message;
    case "thinking_context_loaded": return event.projectStatus;
    case "user_wish_extracted": return `${event.understanding} (${event.wishes.length} wishes)`;
    case "thinking_needs_clarification": return `${event.question} — ${event.reason}`;
    case "thinking_completed": return `${event.taskType}: ${event.normalizedGoal} • Risk: ${event.riskLevel}`;
    case "intent_detected": return `${event.intent.intent} (${Math.round(event.intent.confidence * 100)}%)`;
    case "plan_created": return event.plan.summary;
    case "source_generation_started": return event.message;
    case "file_changed": return `${event.operation}: ${event.path}`;
    case "validation_finished": return `${event.ok ? "Validation passed" : "Validation failed"}: ${event.summary}${event.errors?.length ? ` (${event.errors.length} errors)` : ""}`;
    case "done": return `${event.summary}${event.changedFiles.length ? ` • ${event.changedFiles.length} files changed` : ""}${event.previewUrl ? ` • Preview: ${event.previewUrl}` : ""}`;
    case "error": return event.message;
    case "project_state_updated": return event.projectState.status;
    case "context_retrieved": return `${event.files.length} files`;
    case "clarification_required": return `Needs confirmation: ${event.question}`;
    default: return "";
  }
}
