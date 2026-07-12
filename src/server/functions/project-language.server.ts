import type { ProgressLocale } from "@/server/functions/progress-mapper.server";

/**
 * Project-scoped language context.
 *
 * One language drives BOTH the server-rendered i18n (milestone labels,
 * clarification scaffold, section captions, error/summary fallbacks) AND the
 * codex agent's free-text replies. Deriving both from the same source keeps the
 * chat coherent — previously the server i18n followed the browser's
 * `navigator.language` while the agent mirrored the prompt text, so a
 * Vietnamese-OS user typing English saw English agent replies wrapped in
 * Vietnamese labels (and vice-versa).
 */
export type ProjectLanguageSource =
  | "explicit" // user gave an explicit "reply in X" directive this prompt
  | "detected" // detected from the prompt's own text
  | "stored" // carried over from the project's persisted context
  | "default"; // nothing to go on — fell back to English

export type ResolvedProjectLanguage = {
  locale: ProgressLocale;
  source: ProjectLanguageSource;
  /**
   * True when the user explicitly asked to reply in a language this turn. The
   * dispatcher persists this as the project's sticky context so later ambiguous
   * prompts keep the chosen language.
   */
  isExplicit: boolean;
};

function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Vietnamese-specific letters that never appear in English text. Their presence
// is a hard signal the user is writing Vietnamese.
const VIETNAMESE_DIACRITIC_REGEX =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

// Common Vietnamese function words, ASCII-folded so they match with or without
// diacritics. Chosen to be low-overlap with English tokens.
const VIETNAMESE_WORDS = [
  "toi",
  "ban",
  "cua",
  "cho",
  "khong",
  "duoc",
  "va",
  "voi",
  "trang",
  "san pham",
  "gio hang",
  "thanh toan",
  "mau",
  "chu",
  "hinh",
  "anh",
  "them",
  "sua",
  "xoa",
  "tao",
  "lam",
  "muon",
  "hay",
  "giup",
  "trang chu",
  "phan",
  "nut",
  "menu",
  "tieng viet",
  "tieng anh",
  "hang",
  "gia",
  "danh muc",
];

const ENGLISH_WORDS = [
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "for",
  "with",
  "please",
  "add",
  "remove",
  "change",
  "make",
  "create",
  "update",
  "product",
  "cart",
  "checkout",
  "page",
  "color",
  "button",
  "want",
  "should",
  "can",
  "you",
  "this",
  "that",
  "home",
  "section",
  "image",
  "price",
];

function countWordHits(foldedTokens: string[], vocab: string[]): number {
  const set = new Set(foldedTokens);
  let hits = 0;
  for (const word of vocab) {
    if (word.includes(" ")) {
      // Multi-word phrase: fall back to substring match on the joined text.
      continue;
    }
    if (set.has(word)) hits += 1;
  }
  return hits;
}

/**
 * Detect the language of a prompt from its own text. Returns null when the text
 * is too short or ambiguous to call confidently (e.g. "ok", a bare URL, a hex
 * color) — the caller then falls back to the stored context.
 */
export function detectPromptLanguage(prompt: string): ProgressLocale | null {
  const trimmed = prompt.trim();
  if (!trimmed) return null;

  if (VIETNAMESE_DIACRITIC_REGEX.test(trimmed)) return "vi";

  const folded = stripDiacritics(trimmed.toLowerCase());
  const tokens = folded.split(/[^a-z]+/).filter(Boolean);
  if (tokens.length === 0) return null;

  let viHits = countWordHits(tokens, VIETNAMESE_WORDS);
  // Multi-word Vietnamese phrases matched via substring on the folded text.
  for (const word of VIETNAMESE_WORDS) {
    if (word.includes(" ") && folded.includes(word)) viHits += 1;
  }
  const enHits = countWordHits(tokens, ENGLISH_WORDS);

  if (viHits === 0 && enHits === 0) return null;
  if (viHits > enHits) return "vi";
  if (enHits > viHits) return "en";
  return null;
}

// Explicit "reply in <language>" directives. English-language phrasings first,
// then Vietnamese-language phrasings. Each entry maps to the language the user
// wants REPLIES in (not the language of the directive itself).
const EXPLICIT_DIRECTIVES: Array<{ match: RegExp; locale: ProgressLocale }> = [
  // → Vietnamese
  {
    match:
      /\b(reply|respond|answer|write|talk|speak|chat)\s+(to me\s+)?(in|using)\s+vietnamese\b/i,
    locale: "vi",
  },
  { match: /\b(switch|change)\s+to\s+vietnamese\b/i, locale: "vi" },
  { match: /\bin\s+vietnamese\s+please\b/i, locale: "vi" },
  {
    match:
      /(trả lời|tra loi|nói|noi|viết|viet|dùng|dung|chuyển sang|chuyen sang|đổi sang|doi sang)\s+(bằng\s+|bang\s+)?tiếng việt\b/i,
    locale: "vi",
  },
  {
    match:
      /(trả lời|tra loi|nói|noi|viết|viet|dùng|dung|chuyển sang|chuyen sang|đổi sang|doi sang)\s+(bằng\s+|bang\s+)?tieng viet\b/i,
    locale: "vi",
  },
  // → English
  {
    match:
      /\b(reply|respond|answer|write|talk|speak|chat)\s+(to me\s+)?(in|using)\s+english\b/i,
    locale: "en",
  },
  { match: /\b(switch|change)\s+to\s+english\b/i, locale: "en" },
  { match: /\bin\s+english\s+please\b/i, locale: "en" },
  {
    match:
      /(trả lời|tra loi|nói|noi|viết|viet|dùng|dung|chuyển sang|chuyen sang|đổi sang|doi sang)\s+(bằng\s+|bang\s+)?tiếng anh\b/i,
    locale: "en",
  },
  {
    match:
      /(trả lời|tra loi|nói|noi|viết|viet|dùng|dung|chuyển sang|chuyen sang|đổi sang|doi sang)\s+(bằng\s+|bang\s+)?tieng anh\b/i,
    locale: "en",
  },
];

/**
 * Detect an explicit request to reply in a given language (e.g. "reply in
 * English", "trả lời bằng tiếng Việt"). Returns the requested reply language,
 * or null when the prompt carries no such directive.
 */
export function detectExplicitLanguageDirective(
  prompt: string,
): ProgressLocale | null {
  for (const { match, locale } of EXPLICIT_DIRECTIVES) {
    if (match.test(prompt)) return locale;
  }
  return null;
}

/**
 * Resolve the language for a run given the current prompt and the project's
 * persisted context. The language is LOCKED to the first detection: once a
 * project has a stored context, later prompts keep that language even if a
 * given prompt is written in another tongue — the only thing that flips it is
 * an explicit "reply in X" directive. Precedence (highest first):
 *   1. explicit "reply in X" directive in this prompt  → change/set, sticky
 *   2. stored project context                          → keep it, no re-detect
 *   3. language detected from this (first) prompt       → set the initial lock
 *   4. English default
 */
export function resolveProjectLanguage(input: {
  prompt: string;
  stored: ProgressLocale | null;
}): ResolvedProjectLanguage {
  const explicit = detectExplicitLanguageDirective(input.prompt);
  if (explicit) {
    return { locale: explicit, source: "explicit", isExplicit: true };
  }
  // Already locked: honor the stored context and skip detection so a stray
  // off-language prompt doesn't silently switch the session.
  if (input.stored) {
    return { locale: input.stored, source: "stored", isExplicit: false };
  }
  // First run (no lock yet): detect from the prompt the user just typed.
  const detected = detectPromptLanguage(input.prompt);
  if (detected) {
    return { locale: detected, source: "detected", isExplicit: false };
  }
  return { locale: "en", source: "default", isExplicit: false };
}
