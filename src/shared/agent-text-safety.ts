// Pure, environment-agnostic detectors for code/instruction leakage into
// user-facing agent text. No server-only imports — safe for both
// progress-mapper.server.ts and client-side reducers (agent-event-reducer.ts),
// since streaming deltas (message.delta) render straight into chat state
// without ever passing through the server translator's per-message sanitize.

const FRAMEWORK_TOKENS = [
  "tsx",
  "jsx",
  "vite",
  "tanstack",
  "drizzle",
  "eslint",
  "prettier",
  "pnpm",
  "npm",
  "yarn",
  "tailwind",
  "react",
  "node_modules",
  "pm2",
  "playwright",
  "vitest",
];

const FILE_EXT_PATTERN =
  /[\w./-]+\.(?:tsx?|jsx?|css|scss|json|md|sql|sh|ya?ml)\b/i;
const MULTI_SEGMENT_PATH = /(?:^|\s|`)\/?[\w-]+\/[\w./-]+/;
const CODE_IDENT_BACKTICK = /`[\w_$]{3,}`/;
const CODE_FENCE = /```/;
const HTML_JSX_TAG = /<\/?[A-Za-z][\w-]*(?:\s|>|\/)/;
const OPTIONAL_CHAIN = /\?\./;
const DOTTED_IDENTIFIER = /\b[A-Za-z_$][A-Za-z0-9_$]*\.[A-Za-z_$][A-Za-z0-9_$]*\b/g;
const CAMEL_HUMP = /[a-z][A-Z]/;

const FRAMEWORK_TOKEN_RE = new RegExp(
  `\\b(?:${FRAMEWORK_TOKENS.join("|")})\\b`,
  "i",
);

function isMixedCase(word: string): boolean {
  return /[a-z]/.test(word) && /[A-Z]/.test(word);
}

// Catches dotted property/method access like `DOMPurify.sanitize` or
// `product.defaultModel` — flagged only when at least one side is
// mixed-case, since natural-language abbreviations ("e.g.", "U.S.") are
// single-case and would otherwise false-positive.
function hasDottedIdentifierAccess(text: string): boolean {
  const matches = text.match(DOTTED_IDENTIFIER);
  if (!matches) return false;
  return matches.some((m) => {
    const [left, right] = m.split(".");
    return isMixedCase(left ?? "") || isMixedCase(right ?? "");
  });
}

// Catches bare lowerCamelCase identifiers like `updateItemQuantity`.
// Restricted to lowercase-starting words of length >= 8 to avoid flagging
// short PascalCase/camelCase brand names (YouTube, PayPal, iPhone).
function hasBareCodeIdentifier(text: string): boolean {
  const words = text.match(/\b[a-z][A-Za-z0-9]*\b/g) ?? [];
  return words.some((w) => w.length >= 8 && CAMEL_HUMP.test(w));
}

export function isPrivacySafe(text: string): boolean {
  if (!text) return true;
  if (FILE_EXT_PATTERN.test(text)) return false;
  if (MULTI_SEGMENT_PATH.test(text)) return false;
  if (CODE_IDENT_BACKTICK.test(text)) return false;
  if (CODE_FENCE.test(text)) return false;
  if (HTML_JSX_TAG.test(text)) return false;
  if (FRAMEWORK_TOKEN_RE.test(text)) return false;
  if (OPTIONAL_CHAIN.test(text)) return false;
  if (hasDottedIdentifierAccess(text)) return false;
  if (hasBareCodeIdentifier(text)) return false;
  return true;
}

const CODE_FENCE_BLOCK = /```[\s\S]*?```/g;

// Splits on sentence-ending punctuation followed by whitespace. Good enough
// for the short, plain-language turns the agent produces; doesn't need to be
// a full NLP sentence splitter.
const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

/**
 * Strips code-fenced blocks entirely, then drops any remaining sentence that
 * fails `isPrivacySafe` (file paths, backticked identifiers, dotted/optional
 * chain property access, bare camelCase identifiers, framework tokens, JSX
 * tags). Sentences that read as plain language are kept verbatim and
 * rejoined — this avoids blanking out an entire message just because one
 * clause happened to mention a variable name. Returns "" when nothing safe
 * remains (caller decides the fallback).
 */
export function stripUnsafeContent(text: string): string {
  if (!text) return "";
  const withoutFences = text.replace(CODE_FENCE_BLOCK, " ").trim();
  if (!withoutFences) return "";
  const sentences = withoutFences
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.filter(isPrivacySafe).join(" ").trim();
}
