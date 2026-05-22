import type { AgentStreamEvent } from "../agent/agent-events";
import { deriveContextFromEvents, formatUserFacingStatus } from "../agent/user-facing-presenter";

export type AgentProgressStep = {
  key: string;
  label: string;
  detail?: string;
  status: "completed" | "active" | "failed";
};

const STEP_BY_EVENT: Partial<Record<AgentStreamEvent["type"], string>> = {
  agent_started: "analyzing",
  thinking_started: "understanding",
  user_wish_extracted: "understanding",
  thinking_completed: "planning",
  plan_created: "planning",
  design_file_generated: "design",
  design_file_regenerated: "design",
  design_rules_loaded: "design",
  source_generation_started: "generating",
  file_changed: "generating",
  validation_started: "validating",
  validation_finished: "validating",
  project_state_updated: "saving",
  dev_install_started: "installing",
  dev_install_completed: "installing",
  dev_starting: "starting-preview",
  dev_ready: "preview-ready",
  done: "done",
  error: "error",
};

const FALLBACK_LABELS: Record<string, string> = {
  analyzing: "Analyzing your request",
  understanding: "Understanding storefront requirements",
  planning: "Planning changes",
  design: "Preparing design rules",
  generating: "Creating project files",
  validating: "Checking generated project",
  saving: "Saving project state",
  installing: "Installing dependencies",
  "starting-preview": "Starting preview",
  "preview-ready": "Preview ready",
  done: "Done",
  error: "Could not complete",
};

const STALE_CONTENT = new Set(["Analyzing your request", "### Status\n- Preparing to process your request..."]);

export function deriveAgentProgressSteps(events: AgentStreamEvent[], userPrompt?: string): AgentProgressStep[] {
  const ctx = deriveContextFromEvents(events, { userPrompt });
  const steps = new Map<string, AgentProgressStep>();

  for (const event of events) {
    const key = STEP_BY_EVENT[event.type];
    if (!key) continue;
    const formatted = formatUserFacingStatus(event, ctx);
    const failed = event.type === "error" || event.type === "dev_error" || event.type === "dev_install_failed" || event.type === "dev_fix_failed";
    steps.set(key, {
      key,
      label: formatted?.kind === "user" && formatted.label ? formatted.label : FALLBACK_LABELS[key],
      detail: formatted?.kind === "user" ? formatted.detail : undefined,
      status: failed ? "failed" : "completed",
    });
  }

  const result = [...steps.values()];
  const terminal = result.at(-1)?.key === "done" || result.at(-1)?.status === "failed";
  if (!terminal && result.length > 0) result[result.length - 1] = { ...result[result.length - 1], status: "active" };
  return result;
}

export function synthesizeAgentProgressContent(events: AgentStreamEvent[], userPrompt?: string, fallback = "Analyzing your request") {
  const steps = deriveAgentProgressSteps(events, userPrompt);
  if (steps.length === 0) return fallback;
  return [
    "### Progress",
    ...steps.map((step) => {
      const marker = step.status === "failed" ? "✕" : step.status === "active" ? "…" : "✓";
      return `- ${marker} ${step.label}${step.detail ? ` — ${step.detail}` : ""}`;
    }),
  ].join("\n");
}

export function shouldReplaceStaleAgentContent(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return true;
  if (STALE_CONTENT.has(trimmed)) return true;
  return /^### Status\s*- Preparing to process your request\.\.\.$/m.test(trimmed);
}
