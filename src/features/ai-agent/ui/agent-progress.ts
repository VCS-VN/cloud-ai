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
  dev_error: "error",
  dev_install_failed: "error",
  dev_fix_failed: "error",
};

const FALLBACK_LABELS: Record<string, string> = {
  analyzing: "Understanding your request",
  understanding: "Understanding your request",
  planning: "Planning storefront",
  design: "Preparing design",
  generating: "Creating storefront files",
  validating: "Checking setup",
  saving: "Saving progress",
  installing: "Installing packages",
  "starting-preview": "Starting preview",
  "preview-ready": "Preview ready",
  done: "Done",
  error: "Something went wrong",
};

const STALE_CONTENT = new Set([
  "Analyzing your request",
  "Understanding your request",
  "Preparing to process your request...",
  "### Status\n- Preparing to process your request...",
]);

export function deriveAgentProgressSteps(events: AgentStreamEvent[], userPrompt?: string): AgentProgressStep[] {
  const ctx = deriveContextFromEvents(events, { userPrompt });
  const steps = new Map<string, AgentProgressStep>();

  for (const event of events) {
    const key = STEP_BY_EVENT[event.type];
    if (!key) continue;
    const formatted = formatUserFacingStatus(event, ctx);
    const failed = event.type === "error" || event.type === "dev_error" || event.type === "dev_install_failed" || event.type === "dev_fix_failed";
    const preferFallback = event.type === "file_changed" || event.type === "project_state_updated" || event.type.startsWith("design_") || event.type.startsWith("dev_");
    steps.set(key, {
      key,
      label: preferFallback ? FALLBACK_LABELS[key] : formatted?.kind === "user" && formatted.label ? formatted.label : FALLBACK_LABELS[key],
      detail: preferFallback ? undefined : formatted?.kind === "user" ? formatted.detail : undefined,
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
