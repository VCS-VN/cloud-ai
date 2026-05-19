import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, CircleDashed, FileText, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import type { AgentStreamEvent } from "../agent/agent-events";
import {
  type PresenterContext,
  deriveContextFromEvents,
  formatUserFacingStatus,
} from "../agent/user-facing-presenter";

const TECHNICAL_FALLBACK_LABELS: Partial<Record<AgentStreamEvent["type"], string>> = {
  state_loaded: "Project state loaded",
  thinking_context_loaded: "Thinking context loaded",
  intent_detected: "Intent detected",
  file_changed: "File changed",
  validation_started: "Validation started",
  code_tool_loop_started: "Code tool started",
  code_context_loaded: "Code context loaded",
  tool_call_requested: "Tool requested",
  tool_call_completed: "Tool completed",
  snapshot_created: "Snapshot created",
  patch_applied: "Patch applied",
  repair_started: "Repair started",
  design_file_generated: "Design file generated",
  design_file_regenerated: "Design file regenerated",
  design_rules_loaded: "Design rules loaded",
  dev_install_completed: "Packages installed",
  project_state_updated: "Project state updated",
  context_retrieved: "Context retrieved",
};

function technicalDetail(event: AgentStreamEvent): string | undefined {
  switch (event.type) {
    case "state_loaded": return event.status;
    case "thinking_context_loaded": return event.hasInitializedSource === undefined ? event.projectStatus : `${event.projectStatus} • Source ${event.hasInitializedSource ? "ready" : "not initialized"}`;
    case "intent_detected": return `${event.intent.intent} (${Math.round(event.intent.confidence * 100)}%)`;
    case "file_changed": return `${event.operation}: ${event.path}`;
    case "code_tool_loop_started": return event.taskTitle;
    case "code_context_loaded": return `${event.summary} • ${event.fileCount} files`;
    case "tool_call_requested": return `${event.toolName}: ${event.safeSummary}`;
    case "tool_call_completed": return `${event.toolName}: ${event.summary}`;
    case "snapshot_created": return event.snapshotId;
    case "patch_applied": return `${event.changedFiles.length} files changed • +${event.insertions} -${event.deletions}`;
    case "repair_started": return `${event.reason} • Attempt ${event.attempt}`;
    case "design_file_generated":
    case "design_file_regenerated":
      return `${event.data.source === "ai" ? "AI-generated" : "Heuristic fallback"} → ${event.data.destinationPath} (${(event.data.byteSize / 1024).toFixed(1)} KB)`;
    case "design_rules_loaded": return event.data.summary;
    case "dev_install_completed": return `Installed packages (${(event.durationMs / 1000).toFixed(1)}s)`;
    case "project_state_updated": return event.projectState.status;
    case "context_retrieved": return `${event.files.length} files`;
    default: return undefined;
  }
}

export type AgentEventTimelineProps = {
  events: AgentStreamEvent[];
  userPrompt?: string;
};

export function AgentEventTimeline({ events, userPrompt }: AgentEventTimelineProps) {
  const [showTechnical, setShowTechnical] = useState(false);

  const ctx = useMemo<PresenterContext>(
    () => deriveContextFromEvents(events, { userPrompt }),
    [events, userPrompt],
  );

  const items = useMemo(() => {
    return events
      .filter((event) => event.type !== "assistant_message_delta")
      .map((event) => {
        const formatted = formatUserFacingStatus(event, ctx);
        if (formatted?.kind === "user" && formatted.label) {
          return { event, label: formatted.label, detail: formatted.detail, technical: false };
        }
        const fallbackLabel = TECHNICAL_FALLBACK_LABELS[event.type];
        if (!fallbackLabel) return null;
        return { event, label: fallbackLabel, detail: technicalDetail(event), technical: true };
      })
      .filter((item): item is { event: AgentStreamEvent; label: string; detail?: string; technical: boolean } => item !== null)
      .filter((item) => showTechnical || !item.technical);
  }, [events, ctx, showTechnical]);

  const hasTechnicalEvents = useMemo(
    () => events.some((event) => {
      if (event.type === "assistant_message_delta") return false;
      const formatted = formatUserFacingStatus(event, ctx);
      return formatted?.kind === "technical" && Boolean(TECHNICAL_FALLBACK_LABELS[event.type]);
    }),
    [events, ctx],
  );

  if (items.length === 0 && !hasTechnicalEvents) return null;

  return (
    <section
      className="space-y-xs rounded-md border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-sm text-[12px] text-[var(--app-panel-text)] transition-colors duration-200"
      aria-label="Agent progress timeline"
      aria-live="polite"
    >
      {items.map((item, index) => {
        const highlight =
          item.event.type === "clarification_required" ||
          item.event.type === "thinking_needs_clarification";
        return (
          <div
            key={`${item.event.type}-${index}`}
            className={`flex gap-xs rounded-sm px-xxs py-xxs transition-colors duration-200 hover:bg-[var(--app-control)] ${highlight ? "border border-[var(--app-border)] bg-[var(--app-control)]" : ""}`}
            role={highlight ? "status" : undefined}
          >
            <span className="mt-[2px] text-[var(--app-icon-muted)]">{iconFor(item.event)}</span>
            <div className="min-w-0 flex-1">
              <p className="m-0 font-[520] leading-4">{item.label}</p>
              {item.detail ? (
                <p className="m-0 truncate leading-4 text-[var(--app-muted)]">{item.detail}</p>
              ) : null}
            </div>
          </div>
        );
      })}

      {hasTechnicalEvents ? (
        <button
          type="button"
          onClick={() => setShowTechnical((value) => !value)}
          className="mt-xs flex items-center gap-xxs text-[11px] text-[var(--app-muted)] hover:text-[var(--app-panel-text)] transition-colors"
          aria-expanded={showTechnical}
        >
          {showTechnical ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
          {showTechnical ? "Hide technical details" : "Show technical details"}
        </button>
      ) : null}
    </section>
  );
}

function iconFor(event: AgentStreamEvent) {
  if (event.type === "clarification_required" || event.type === "thinking_needs_clarification") return <TriangleAlert aria-hidden="true" size={14} className="text-[var(--app-icon-selected)]" />;
  if (event.type === "error" || event.type === "human_review_required") return <TriangleAlert aria-hidden="true" size={14} className="text-[var(--app-icon)]" />;
  if (event.type === "done" || event.type === "validation_finished" || event.type === "project_state_updated" || event.type === "thinking_completed" || event.type === "code_tool_loop_completed") return <CheckCircle2 aria-hidden="true" size={14} className="text-[var(--app-icon-selected)]" />;
  if (event.type === "file_changed" || event.type === "patch_applied") return <FileText aria-hidden="true" size={14} className="text-[var(--app-icon-muted)]" />;
  if (event.type === "source_generation_started" || event.type === "validation_started" || event.type === "thinking_started" || event.type === "code_tool_loop_started" || event.type === "tool_call_requested" || event.type === "repair_started") return <Loader2 aria-hidden="true" size={14} className="animate-spin text-[var(--app-icon-muted)]" />;
  if (event.type === "dev_install_started" || event.type === "dev_starting") return <Loader2 aria-hidden="true" size={14} className="animate-spin text-[var(--app-icon-muted)]" />;
  if (event.type === "dev_install_completed" || event.type === "dev_ready" || event.type === "dev_fix_applied") return <CheckCircle2 aria-hidden="true" size={14} className="text-[var(--app-icon-selected)]" />;
  if (event.type === "dev_install_failed" || event.type === "dev_error" || event.type === "dev_fix_failed") return <TriangleAlert aria-hidden="true" size={14} className="text-[var(--app-icon)]" />;
  if (event.type === "dev_fix_attempt") return <RefreshCw aria-hidden="true" size={14} className="animate-spin text-[var(--app-icon-muted)]" />;
  return <CircleDashed aria-hidden="true" size={14} className="text-[var(--app-icon-subtle)]" />;
}
