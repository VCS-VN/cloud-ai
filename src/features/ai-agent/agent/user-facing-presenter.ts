export type PresenterContext = {
  userPrompt?: string;
  userFacingUnderstanding?: string;
};

export const TECHNICAL_PATTERNS: { pattern: RegExp; replace: string }[] = [
  // T067: File paths — absolute and relative
  { pattern: /\b(?:src|projects|public|node_modules|app|dist|build)\/[\w./-]+/g, replace: "your storefront" },
  { pattern: /\b[\w./-]+\.(?:tsx?|jsx?|css|json|md|env|html|svg|png|jpg)\b/g, replace: "your storefront" },
  { pattern: /\b(?:routeTree\.gen|__root|package\.json|drizzle\.config|tsconfig\.json|vite\.config)\b/g, replace: "" },

  // T067: Env vars & secrets
  { pattern: /\bVITE_[A-Z0-9_]+\b/g, replace: "" },
  { pattern: /\b(?:process\.env\.)?[A-Z][A-Z0-9_]{3,}_(?:KEY|TOKEN|URL|SECRET|ID|SLUG|HOST)\b/g, replace: "" },

  // T067: Package names (npm, imports)
  { pattern: /\b(?:node_modules\/)?@?[\w.-]+\/[\w.-]+(?:@[\d.]+)?\b/g, replace: "" },
  { pattern: /\b(?:import\s+.*?\s+from\s+['"][^'"]+['"])\s*;?/g, replace: "" },

  // T067: API endpoints
  { pattern: /\b(?:\/api\/[\w./-]+|GET\s+\/[\w./-]+|POST\s+\/[\w./-]+)\b/g, replace: "" },

  // T067: Model names / AI
  { pattern: /\b(?:gpt-[\w.-]+|claude-[\w.-]+|openai|anthropic|gemini|llama)\b/gi, replace: "" },

  // T067: DB / schema terms
  { pattern: /\b(?:drizzle|postgres|postgresql|sqlite|mysql|migration)\b/gi, replace: "" },
  { pattern: /\bschema\b(?:\s*\.\s*ts)?/gi, replace: "structure" },

  // T067: Tool names
  { pattern: /\bcode_tool_\w+|\bapply_patch\b|\bread_file\b|\bwrite_file\b|\bproject_(?:read|get|write|create|run|apply|search)_\w+/g, replace: "" },
  { pattern: /\b(?:write|edit|glob|grep)\b(?=\s+(?:tool|for|to)\b)/gi, replace: "" },
  { pattern: /\bDESIGN\.md\b|\bblocks\.json\b/gi, replace: "design guidelines" },
  { pattern: /\b(?:tasteSkillLoaded|designRulesLoaded|__designSourceHash)\b/g, replace: "" },
  { pattern: /\b(?:bootstrap\s+)?deadlock\b|\btool\s+lock\b|\bplatform\s+fix\b/gi, replace: "" },
  { pattern: /\b(?:Need|Try|Block(?:er)?)\s+(?:to\s+)?(?:call|load|write|author)\b[^\n.]*/gi, replace: "" },
  { pattern: /\bReading this as:\s*/gi, replace: "" },
  { pattern: /\b(?:init|agentic)[-_]?\w*\b/gi, replace: "" },

  // T067: Server / framework names
  { pattern: /\b(?:vite|tanstack|react|next\.js|nuxt|express|fastify)\b/gi, replace: "" },

  // T067: Internal type names
  { pattern: /\b(?:ProjectState|BuilderIntent|ChangePlan|ThinkingResult|WebsiteSpec|AgentStreamEvent|ToolExecutionContext)\b/g, replace: "your storefront" },

  // T067: Intent lifecycle terms
  { pattern: /\b(?:init_project|modify_design|modify_content|modify_products|add_feature|fix_bug|explain_project|needs_clarification|init_storefront_project|content_update|design_update|product_data_update|bug_fix|answer_question)\b/g, replace: "your request" },

  // T069: Code blocks — markdown fenced blocks
  { pattern: /```[\s\S]*?```/g, replace: "" },

  // T069: Inline code
  { pattern: /`[^`]*`/g, replace: "" },
];

// T068: Design language passthrough — these patterns are NEVER blocked
// - Color: hex (#1a1a2e), rgb/rgba, hsl/hsla, tailwind names (slate-50, red-500)
// - Font: font family names (Geist, Playfair, Inter, JetBrains Mono)
// - Typography: font-size, line-height, font-weight, letter-spacing, text-transform
// - Spacing: px, rem, em, vh/vw, gap, margin, padding, width/height values
// - Layout: grid, flex, bento, masonry, sidebar, header, footer, hero, carousel
// - UX: hover, transition, animation, scroll, sticky, overlay, drawer, modal
// These are DESIGN LANGUAGE — they are NOT in TECHNICAL_PATTERNS → they pass through.

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

const INTERNAL_REASONING_LINE =
  /(?:project_|tool_|design_rules|taste_skill|deadlock|blocker|cannot safely|need (?:to )?(?:call|load|write|author)|first\s+create|then\s+call|variance\s+\d|motion\s+\d|density\s+\d|palette:|dials?:)/i;

/**
 * Returns true when a streamed chunk is almost entirely internal agent reasoning
 * (tool names, file paths, gate errors) and should not be shown to the user.
 */
export function isInternalAgentReasoningChunk(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (INTERNAL_REASONING_LINE.test(trimmed)) return true;
  const letters = trimmed.replace(/[^a-zA-Z]/g, "");
  const snakeTokens = trimmed.match(/[a-z]+_[a-z0-9_]+/g) ?? [];
  if (snakeTokens.length >= 2) return true;
  if (/\.(?:tsx?|jsx?|md)\b/.test(trimmed)) return true;
  if (letters.length < 8 && /[{}[\]()`]/.test(trimmed)) return true;
  return false;
}

/** Per-delta filter for assistant streaming: redact tokens and drop internal reasoning. */
export function filterAssistantDeltaForUser(text: string): string {
  if (!text || isInternalAgentReasoningChunk(text)) return "";
  const redacted = redactTechnicalText(text);
  if (!redacted.trim() || isInternalAgentReasoningChunk(redacted)) return "";
  return redacted;
}

type ToolActivityCategory = "inspect" | "mutate" | "validate" | "planning" | string;

const TOOL_ACTIVITY_LABELS: Record<string, string> = {
  write: "Creating storefront content",
  project_create_file: "Creating storefront content",
  edit: "Updating storefront content",
  project_apply_patch: "Updating storefront content",
  project_read_design_rules: "Loading your shop design",
  project_read_taste_skill: "Applying design standards",
  project_get_file_tree: "Reviewing your shop structure",
  project_read_file: "Reviewing your shop",
  project_search_code: "Searching your shop",
  project_run_validation: "Checking your shop",
  project_get_context: "Reviewing your shop",
  glob: "Scanning your shop files",
  grep: "Searching your shop",
};

export function buildFriendlyToolActivitySummary(
  toolName: string,
  category: ToolActivityCategory,
): string {
  const label = TOOL_ACTIVITY_LABELS[toolName];
  if (label) return label;
  switch (category) {
    case "mutate":
      return "Updating your storefront";
    case "validate":
      return "Checking your storefront";
    case "inspect":
      return "Reviewing your storefront";
    default:
      return "Working on your storefront";
  }
}

export function buildFriendlyToolCompletedSummary(
  toolName: string,
  category: ToolActivityCategory,
  ok: boolean,
): string {
  const activity = buildFriendlyToolActivitySummary(toolName, category);
  if (!ok) return `${activity} — needs another try`;
  return `${activity} — done`;
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
