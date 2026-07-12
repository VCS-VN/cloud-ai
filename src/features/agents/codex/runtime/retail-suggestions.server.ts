import { z } from "zod";
import { isPrivacySafe } from "@/server/functions/progress-mapper.server";
import { KNOWN_PAGES } from "./generate-page";

// One-shot retail follow-up suggestions. After a build turn completes, we ask
// the model for a few short, retail-storefront-oriented next steps the user
// could take (e.g. "Add a checkout page", "Feature bestsellers on the home
// hero"). Like design-variants, this only needs a JSON reply — no apply_patch /
// exec — so the caller runs it through runResponsesTurn, bypassing the codex
// CLI agent loop entirely.

const SUGGESTION_COUNT = 4;
const MAX_SUGGESTION_LEN = 80;

const suggestionSchema = z
  .string()
  .min(1)
  .max(MAX_SUGGESTION_LEN)
  .refine((s) => isPrivacySafe(s), {
    message: "suggestion must be privacy-safe (no paths, code, framework tokens)",
  });

const suggestionArraySchema = z
  .array(suggestionSchema)
  .min(1)
  .max(SUGGESTION_COUNT)
  .superRefine((arr, ctx) => {
    const seen = new Set<string>();
    for (const s of arr) {
      const key = s.trim().toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "duplicate suggestion",
        });
      }
      seen.add(key);
    }
  });

export type RetailSuggestionsResult =
  | { ok: true; suggestions: string[] }
  | { ok: false; reason: string };

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json|JSON)?\s*\n([\s\S]*?)\n?```\s*$/);
  if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim();
  const arrayStart = trimmed.indexOf("[");
  const objectStart = trimmed.indexOf("{");
  const start =
    arrayStart === -1
      ? objectStart
      : objectStart === -1
        ? arrayStart
        : Math.min(arrayStart, objectStart);
  if (start === -1) return trimmed;
  const opener = trimmed[start];
  const closer = opener === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === opener) depth++;
    else if (ch === closer) {
      depth--;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }
  return trimmed;
}

function tryParseSuggestions(rawResponse: string): RetailSuggestionsResult {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFence(rawResponse));
  } catch {
    return { ok: false, reason: "invalid JSON" };
  }
  // Accept a bare array or { suggestions: [...] } — models drift between both.
  const arr = Array.isArray(json)
    ? json
    : json && typeof json === "object" && Array.isArray((json as { suggestions?: unknown }).suggestions)
      ? (json as { suggestions: unknown[] }).suggestions
      : null;
  if (!arr) return { ok: false, reason: "expected an array or { suggestions: [] } object" };
  // Truncate over-long entries before validation so a single verbose line
  // doesn't sink the whole set (Vietnamese prose tends to overshoot).
  const trimmed = arr.map((s) =>
    typeof s === "string" && s.length > MAX_SUGGESTION_LEN
      ? s.slice(0, MAX_SUGGESTION_LEN - 1).trimEnd() + "…"
      : s,
  );
  const parsed = suggestionArraySchema.safeParse(trimmed);
  if (parsed.success) {
    return { ok: true, suggestions: parsed.data.map((s) => s.trim()) };
  }
  return {
    ok: false,
    reason: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
  };
}

export type GenerateRetailSuggestionsInput = {
  runTurn: () => Promise<{ finalResponse: string }>;
  /** Maximum retries on JSON-validation failure. Default 1 (retry once). */
  retryOnInvalidJson?: number;
};

export async function generateRetailSuggestions(
  input: GenerateRetailSuggestionsInput,
): Promise<RetailSuggestionsResult> {
  const maxRetries = input.retryOnInvalidJson ?? 1;
  let lastReason = "no attempt";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const turn = await input.runTurn();
    const result = tryParseSuggestions(turn.finalResponse);
    if (result.ok) return result;
    lastReason = result.reason;
  }
  return { ok: false, reason: lastReason };
}

export type RetailSuggestionsContext = {
  storeName?: string;
  recentUserPrompt?: string;
  recentAgentAnswer?: string;
  generatedPageSlugs?: string[];
};

// Build the one-shot prompt. We give the model the store concept, what the user
// just asked for, and which storefront pages already exist so it can steer
// toward retail next-steps (missing pages, merchandising, conversion) rather
// than generic web-dev advice.
export function buildRetailSuggestionsPrompt(context: RetailSuggestionsContext): string {
  const existing = new Set(context.generatedPageSlugs ?? []);
  const missingPages = KNOWN_PAGES.filter((p) => !existing.has(p.slug)).map((p) => p.label);
  const lines = [
    "You help a merchant iterate on their online retail storefront.",
    "Propose short, actionable NEXT-STEP suggestions the merchant could send as their next request to improve the store.",
    "",
    context.storeName ? `Store: ${context.storeName}` : "",
    context.recentUserPrompt ? `The user just asked: ${context.recentUserPrompt}` : "",
    context.recentAgentAnswer ? `You just did: ${context.recentAgentAnswer}` : "",
    existing.size > 0
      ? `Pages that already exist: ${[...existing].join(", ")}.`
      : "No storefront pages exist yet.",
    missingPages.length > 0
      ? `Storefront pages not built yet: ${missingPages.join(", ")}.`
      : "All standard storefront pages exist.",
    "",
    "Rules:",
    `- Return EXACTLY a JSON array of ${SUGGESTION_COUNT} strings, nothing else.`,
    `- Each suggestion is a concise imperative phrase (max ${MAX_SUGGESTION_LEN} chars), phrased as a request the user could click and send.`,
    "- Focus on retail/e-commerce outcomes: product presentation, merchandising, conversion, checkout, promotions, trust.",
    "- Prefer suggesting pages that are not built yet when relevant.",
    "- No file paths, code, framework names, or technical jargon.",
    "- Match the language of the user's most recent request.",
    "",
    'Example format: ["Add a checkout page", "Feature bestsellers on the home hero", "Show customer reviews on product pages", "Add a limited-time promo banner"]',
  ];
  return lines.filter((l) => l !== "").join("\n");
}

