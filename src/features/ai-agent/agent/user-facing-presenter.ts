export type PresenterContext = {
  userPrompt?: string;
  userFacingUnderstanding?: string;
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
  return "Something went wrong. You can retry safely.";
}
