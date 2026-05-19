import type { AgentStreamEvent } from "./agent-events";

export type PresenterContext = {
  userPrompt?: string;
  userFacingUnderstanding?: string;
};

export type PresentedStatus = {
  kind: "user" | "technical";
  label?: string;
  detail?: string;
};

export const TECHNICAL_PATTERNS: { pattern: RegExp; replace: string }[] = [
  { pattern: /\bVITE_[A-Z0-9_]+\b/g, replace: "" },
  { pattern: /\b(?:process\.env\.)?[A-Z][A-Z0-9_]{3,}_(?:KEY|TOKEN|URL|SECRET|ID|SLUG|HOST)\b/g, replace: "" },
  { pattern: /\b(?:ProjectState|BuilderIntent|ChangePlan|ThinkingResult|WebsiteSpec|AgentStreamEvent|ToolExecutionContext)\b/g, replace: "your storefront" },
  { pattern: /\b(?:src|projects|public|node_modules)\/[\w./-]+/g, replace: "your storefront" },
  { pattern: /\b[\w./-]+\.(?:tsx?|jsx?|css|json|md|env)\b/g, replace: "your storefront" },
  { pattern: /\b(?:routeTree\.gen|__root|package\.json|drizzle\.config)\b/g, replace: "" },
  { pattern: /\b(?:init_project|modify_design|modify_content|modify_products|add_feature|fix_bug|explain_project|needs_clarification|init_storefront_project|content_update|design_update|product_data_update|bug_fix|answer_question)\b/g, replace: "your request" },
  { pattern: /\b(?:gpt-[\w.-]+|claude-[\w.-]+|openai|anthropic)\b/gi, replace: "" },
  { pattern: /`[^`]*`/g, replace: "" },
  { pattern: /\bcode_tool_\w+|\bapply_patch\b|\bread_file\b|\bwrite_file\b|\bproject_(?:read|get|write)_\w+/g, replace: "" },
];

export function sanitizeForUser(text: string): string {
  if (!text) return "";
  let out = text;
  for (const { pattern, replace } of TECHNICAL_PATTERNS) out = out.replace(pattern, replace);
  return out.replace(/\s{2,}/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
}

export function mapErrorCodeToFriendly(code?: string): string {
  if (code === "PROVIDER_NOT_CONFIGURED") return "AI is not available right now. Please try again later.";
  return "Could not complete the request. Please try again or adjust your prompt.";
}

function shortPrompt(ctx: PresenterContext, max = 80): string | undefined {
  const raw = ctx.userFacingUnderstanding ?? ctx.userPrompt;
  if (!raw) return undefined;
  const sanitized = sanitizeForUser(raw);
  if (!sanitized) return undefined;
  return sanitized.length > max ? `${sanitized.slice(0, max - 1).trim()}…` : sanitized;
}

const TECHNICAL: PresentedStatus = { kind: "technical" };

export function formatUserFacingStatus(
  event: AgentStreamEvent,
  ctx: PresenterContext,
): PresentedStatus | undefined {
  switch (event.type) {
    case "agent_started":
      return { kind: "user", label: "Analyzing your request" };
    case "thinking_started":
      return { kind: "user", label: "Understanding your request" };
    case "user_wish_extracted": {
      const detail = sanitizeForUser(event.understanding);
      return { kind: "user", label: "Got it", detail: detail || undefined };
    }
    case "thinking_needs_clarification":
      return { kind: "user", label: "Need clarification", detail: sanitizeForUser(event.question) || undefined };
    case "thinking_completed":
      return { kind: "user", label: "Ready to build" };
    case "clarification_required":
      return { kind: "user", label: "Need clarification", detail: sanitizeForUser(event.question) || undefined };
    case "plan_created":
      return { kind: "user", label: "Plan ready" };
    case "source_generation_started": {
      const isUpdate = /incremental|patch|update/i.test(event.message ?? "");
      return { kind: "user", label: isUpdate ? "Updating your storefront" : "Building your storefront" };
    }
    case "validation_finished": {
      const ok = event.ok ?? event.status === "passed";
      return { kind: "user", label: ok ? "Checks passed" : "Some issues to fix" };
    }
    case "code_tool_loop_completed":
      return { kind: "user", label: "Build completed" };
    case "human_review_required":
      return { kind: "user", label: "Needs your review", detail: sanitizeForUser(event.reason) || undefined };
    case "preview_restart_required":
      return { kind: "user", label: "Restarting preview" };
    case "dev_install_started":
      return { kind: "user", label: "Setting up your storefront" };
    case "dev_install_failed":
      return { kind: "user", label: "Setup failed" };
    case "dev_starting":
      return { kind: "user", label: "Starting your preview" };
    case "dev_ready":
      return { kind: "user", label: "Your preview is ready" };
    case "dev_error":
      return { kind: "user", label: "Preview hit an error" };
    case "dev_fix_attempt":
      return { kind: "user", label: "Trying a fix" };
    case "dev_fix_applied":
      return { kind: "user", label: "Fix applied" };
    case "dev_fix_failed":
      return { kind: "user", label: "Could not auto-fix" };
    case "done": {
      const detail = shortPrompt(ctx);
      return { kind: "user", label: "Done", detail };
    }
    case "error":
      return { kind: "user", label: "Could not complete", detail: mapErrorCodeToFriendly(event.code) };

    case "state_loaded":
    case "thinking_context_loaded":
    case "intent_detected":
    case "assistant_message_delta":
    case "file_changed":
    case "validation_started":
    case "code_tool_loop_started":
    case "code_context_loaded":
    case "tool_call_requested":
    case "tool_call_completed":
    case "snapshot_created":
    case "patch_applied":
    case "repair_started":
    case "design_file_generated":
    case "design_file_regenerated":
    case "design_rules_loaded":
    case "dev_install_completed":
    case "project_state_updated":
    case "context_retrieved":
      return TECHNICAL;
    default:
      return TECHNICAL;
  }
}

export function deriveContextFromEvents(
  events: AgentStreamEvent[],
  base: PresenterContext = {},
): PresenterContext {
  const ctx: PresenterContext = { ...base };
  for (const event of events) {
    if (event.type === "user_wish_extracted") ctx.userFacingUnderstanding = event.understanding;
  }
  return ctx;
}
