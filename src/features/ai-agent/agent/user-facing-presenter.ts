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

/**
 * Redact technical tokens (file paths, env vars, tool/model names, etc.) WITHOUT
 * trimming or collapsing whitespace. Safe to apply per streamed delta: it never
 * eats the spaces at chunk boundaries, so accumulated text keeps word spacing.
 */
export function redactTechnicalText(text: string): string {
  if (!text) return "";
  let out = text;
  for (const { pattern, replace } of TECHNICAL_PATTERNS) out = out.replace(pattern, replace);
  return out;
}

/**
 * Full sanitize for a COMPLETE string: redacts technical tokens, then collapses
 * runs of whitespace and trims. MUST NOT be applied per-delta during streaming —
 * the trailing trim would strip boundary spaces and stick words together.
 * Use redactTechnicalText for incremental/streamed chunks instead.
 */
export function sanitizeForUser(text: string): string {
  if (!text) return "";
  return redactTechnicalText(text)
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

export type UserLanguage = "vi" | "en";

const VIETNAMESE_DIACRITICS =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/**
 * Detect the language to address the user in. Prefers an explicit hint from the
 * thinking layer (an LLM-derived signal), then falls back to a diacritics
 * heuristic on the user's prompt, then English. Runs on the error path too,
 * where the prompt is always available even if thinking never ran.
 */
export function detectUserLanguage(input: {
  thinkingLanguage?: string;
  userPrompt?: string;
}): UserLanguage {
  const hint = input.thinkingLanguage?.toLowerCase();
  if (hint === "vi" || hint === "vietnamese" || hint === "tiếng việt") return "vi";
  if (hint === "en" || hint === "english") return "en";
  if (input.userPrompt && VIETNAMESE_DIACRITICS.test(input.userPrompt)) return "vi";
  return "en";
}

type ErrorGroup = "provider_busy" | "provider_unavailable" | "interrupted" | "generic";

/**
 * Maps a raw provider/run error into a coarse, user-facing group. The raw
 * technical message is NEVER surfaced — only used here to pick a friendly group.
 */
export function classifyRunError(args: { code?: string; rawMessage?: string }): ErrorGroup {
  const code = args.code?.toUpperCase() ?? "";
  const raw = args.rawMessage?.toLowerCase() ?? "";
  if (code === "RUN_INTERRUPTED") return "interrupted";
  if (code === "PROVIDER_NOT_CONFIGURED") return "provider_unavailable";
  if (
    /timeout|timed out|rate.?limit|429|503|overload|too many requests|econnreset|etimedout/.test(raw)
  ) {
    return "provider_busy";
  }
  return "generic";
}

const FRIENDLY_ERROR_MESSAGES: Record<ErrorGroup, Record<UserLanguage, string>> = {
  provider_busy: {
    vi: "AI đang xử lý nhiều yêu cầu một chút. Bạn thử lại sau giây lát nhé.",
    en: "The AI is a bit busy right now. Please try again in a moment.",
  },
  provider_unavailable: {
    vi: "AI tạm thời chưa sẵn sàng. Bạn vui lòng thử lại sau nhé.",
    en: "The AI isn't available right now. Please try again shortly.",
  },
  interrupted: {
    vi: "Quá trình bị gián đoạn giữa chừng. Bạn có thể thử lại an toàn.",
    en: "The process was interrupted. You can retry safely.",
  },
  generic: {
    vi: "Mình gặp một chút trục trặc khi xử lý yêu cầu. Bạn thử lại nhé — thường chỉ là tạm thời thôi.",
    en: "I hit a snag while working on this. Please try again — it's usually temporary.",
  },
};

/** Friendly, non-technical error text for a run failure, in the user's language. */
export function buildFriendlyErrorContent(args: {
  code?: string;
  rawMessage?: string;
  language: UserLanguage;
}): string {
  const group = classifyRunError({ code: args.code, rawMessage: args.rawMessage });
  return FRIENDLY_ERROR_MESSAGES[group][args.language];
}

const INTERRUPTED_ANSWER_SUFFIX: Record<UserLanguage, string> = {
  vi: "…(bị gián đoạn giữa chừng — bạn thử lại nhé)",
  en: "…(interrupted — please try again)",
};

/** Suffix appended to a partial answer when the run is interrupted mid-stream. */
export function interruptedAnswerSuffix(language: UserLanguage): string {
  return INTERRUPTED_ANSWER_SUFFIX[language];
}

const STILL_WORKING_LABEL: Record<UserLanguage, string> = {
  vi: "Vẫn đang xử lý, việc này mất hơn chút thời gian…",
  en: "Still working on it, this is taking a moment…",
};

/** Skeleton label shown when a phase goes quiet for a while (no events). */
export function stillWorkingLabel(language: UserLanguage): string {
  return STILL_WORKING_LABEL[language];
}
