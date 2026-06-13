import { z } from "zod";
import {
  isPrivacySafe,
} from "@/server/functions/progress-mapper.server";
import type { DesignVariant } from "@/shared/project-types";

const HEX_PATTERN = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const designVariantSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(40),
  description: z
    .string()
    .min(1)
    .max(240)
    .refine((s) => isPrivacySafe(s), {
      message: "description must be privacy-safe (no paths, code, framework tokens)",
    }),
  preview: z.object({
    font: z.string().min(1),
    palette: z
      .array(z.string().regex(HEX_PATTERN))
      .min(3)
      .max(5),
    motion: z.number().min(0).max(1),
    density: z.number().min(0).max(1).optional(),
  }),
});

const designVariantArraySchema = z
  .array(designVariantSchema)
  .length(4)
  .superRefine((arr, ctx) => {
    const ids = new Set<string>();
    for (const v of arr) {
      if (ids.has(v.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["id"],
          message: "duplicate id within variant payload",
        });
      }
      ids.add(v.id);
    }
  });

export type DesignVariantValidationResult =
  | { ok: true; variants: DesignVariant[] }
  | { ok: false; reason: string };

export function validateDesignVariants(input: unknown): DesignVariantValidationResult {
  const parsed = designVariantArraySchema.safeParse(input);
  if (parsed.success) return { ok: true, variants: parsed.data };
  const reason = parsed.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  return { ok: false, reason };
}

/**
 * Lightweight question validator: privacy-safe, length-capped. The model
 * proposes the question wording so it can be tailored to the store concept;
 * we keep the safety bar low so a flexible question shape doesn't fail the
 * whole variant turn — fall back to the default in that case.
 */
function isUsableQuestion(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return false;
  return isPrivacySafe(trimmed);
}

/**
 * Generate four retail-vibe design variants for an init flow (US4 / R7).
 * Real implementation runs a codex thread with sandbox=read-only and an output
 * schema; this module exposes the validator + helpers used by the driver.
 *
 * For testability, the codex turn is injected via the `runTurn` parameter; the
 * production path passes the actual BoundedCodexThread.
 */
export type GenerateRetailVariantsInput = {
  runTurn: () => Promise<{ finalResponse: string }>;
  /** Maximum retries on JSON-validation failure. Default 1 (retry once). */
  retryOnInvalidJson?: number;
};

export type GenerateRetailVariantsResult =
  | { ok: true; variants: DesignVariant[]; question?: string; rawResponse: string }
  | { ok: false; reason: string };

function stripCodeFence(raw: string): string {
  // Models often wrap JSON in ```json … ``` or bare ```. Strip the fence and
  // any surrounding prose. We accept either: a leading fence opener, OR a
  // bare object/array buried in narrative text.
  const trimmed = raw.trim();
  // 1) Strip leading/trailing triple-backtick fence
  const fenceMatch = trimmed.match(/^```(?:json|JSON)?\s*\n([\s\S]*?)\n?```\s*$/);
  if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim();
  // 2) Extract first balanced JSON object/array from the text
  const objectStart = trimmed.indexOf("{");
  const arrayStart = trimmed.indexOf("[");
  const start =
    objectStart === -1
      ? arrayStart
      : arrayStart === -1
        ? objectStart
        : Math.min(objectStart, arrayStart);
  if (start === -1) return trimmed;
  // Find matching closer by balancing
  const opener = trimmed[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === opener) depth++;
    else if (ch === closer) {
      depth--;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }
  return trimmed; // unbalanced — let JSON.parse fail with a clearer error
}

// Common CSS color names the model sometimes emits instead of hex. Mapped to
// 6-digit hex so the variant survives validation instead of being discarded.
const NAMED_COLORS: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  orange: "#ffa500",
  purple: "#800080",
  pink: "#ffc0cb",
  brown: "#a52a2a",
  gray: "#808080",
  grey: "#808080",
  beige: "#f5f5dc",
  cream: "#fffdd0",
  gold: "#ffd700",
  silver: "#c0c0c0",
  navy: "#000080",
  teal: "#008080",
  olive: "#808000",
  maroon: "#800000",
};

// Coerce a model-provided color into a #RRGGBB / #RRGGBBAA hex string, or return
// null if it can't be salvaged. Handles: missing `#`, 3-digit shorthand
// (#abc → #aabbcc), uppercase, and a handful of CSS color names. The variant
// turn frequently returns one of these forms and the strict hex regex was
// discarding otherwise-good variants (see design_variants_generation_failed:
// "Invalid string: must match pattern /^#(?:[0-9a-fA-F]{6|8})$/").
function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let s = value.trim().toLowerCase();
  if (NAMED_COLORS[s]) return NAMED_COLORS[s];
  if (!s.startsWith("#")) s = "#" + s;
  // #abc → #aabbcc
  if (/^#[0-9a-f]{3}$/.test(s)) {
    s = "#" + s.slice(1).split("").map((c) => c + c).join("");
  }
  // #abcd → #aabbccdd (4-digit shorthand with alpha)
  if (/^#[0-9a-f]{4}$/.test(s)) {
    s = "#" + s.slice(1).split("").map((c) => c + c).join("");
  }
  if (/^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/.test(s)) return s;
  return null;
}

// Normalize a palette array: coerce each entry to valid hex, drop the ones that
// can't be salvaged. Returns the cleaned array (may be shorter); the schema's
// .min(3) still rejects a palette too damaged to use, but a single stray entry
// no longer sinks the whole variant.
function normalizePalette(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const cleaned = value.map(normalizeHexColor).filter((c): c is string => c !== null);
  return cleaned;
}

function normalizeVariantShape(raw: unknown): unknown {
  // Tolerate model field-name drift: accept both `label`/`name` and
  // `id`/`vibe`. Also auto-truncate `description` to 240 chars before
  // validation, since Vietnamese prose tends to overshoot tighter limits.
  if (Array.isArray(raw)) return raw.map(normalizeVariantShape);
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.variants)) {
    // Preserve a sibling `question` so the model can propose its own wording.
    const out: Record<string, unknown> = {
      variants: (obj.variants as unknown[]).map(normalizeVariantShape),
    };
    if (typeof obj.question === "string") out.question = obj.question;
    return out;
  }
  const reshape: Record<string, unknown> = { ...obj };
  if (!reshape.label && typeof obj.name === "string") reshape.label = obj.name;
  if (!reshape.id && typeof obj.vibe === "string") {
    reshape.id = String(obj.vibe).toLowerCase().replace(/\s+/g, "-");
  }
  if (typeof reshape.description === "string" && reshape.description.length > 240) {
    reshape.description = reshape.description.slice(0, 237).trimEnd() + "…";
  }
  if (typeof reshape.label === "string" && reshape.label.length > 40) {
    reshape.label = reshape.label.slice(0, 40).trimEnd();
  }
  // Coerce palette entries to valid hex before validation: the model often
  // returns #abc shorthand, bare "aabbcc" (no #), or a CSS color name, any of
  // which the strict hex regex would reject and sink the whole variant turn.
  if (reshape.preview && typeof reshape.preview === "object" && !Array.isArray(reshape.preview)) {
    const preview = { ...(reshape.preview as Record<string, unknown>) };
    if ("palette" in preview) preview.palette = normalizePalette(preview.palette);
    reshape.preview = preview;
  }
  return reshape;
}

function tryParseVariants(
  rawResponse: string,
): DesignVariantValidationResult & { question?: string } {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFence(rawResponse));
  } catch {
    return { ok: false, reason: "invalid JSON" };
  }
  const normalized = normalizeVariantShape(json);
  // Allow the model to wrap the array in an object: { variants: [...] } or
  // { question, variants: [...] } so it can also propose the question wording.
  if (Array.isArray(normalized)) {
    const result = validateDesignVariants(normalized);
    return result.ok ? { ...result } : result;
  }
  if (
    normalized &&
    typeof normalized === "object" &&
    Array.isArray((normalized as { variants?: unknown }).variants)
  ) {
    const obj = normalized as { variants: unknown[]; question?: unknown };
    const result = validateDesignVariants(obj.variants);
    if (!result.ok) return result;
    return {
      ok: true,
      variants: result.variants,
      question: isUsableQuestion(obj.question) ? obj.question.trim() : undefined,
    };
  }
  return { ok: false, reason: "expected an array or { variants: [] } object" };
}

export async function generateRetailVariants(
  input: GenerateRetailVariantsInput,
): Promise<GenerateRetailVariantsResult> {
  const maxRetries = input.retryOnInvalidJson ?? 1;
  let lastReason = "no attempt";
  let lastResponse = "";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const turn = await input.runTurn();
    lastResponse = turn.finalResponse;
    const validation = tryParseVariants(turn.finalResponse);
    if (validation.ok) {
      return {
        ok: true,
        variants: validation.variants,
        question: validation.question,
        rawResponse: turn.finalResponse,
      };
    }
    lastReason = validation.reason;
  }
  return { ok: false, reason: lastReason };
}

/**
 * Build the prompt fragment that augments the init build with the chosen
 * variant's preview tokens, OR the user's free-text guidance.
 */
export function buildVariantBuildPrompt(input: {
  selectedVariant?: DesignVariant;
  freeText?: string;
}): string {
  if (input.freeText && input.freeText.trim()) {
    return `User design guidance: ${input.freeText.trim()}\n\nApply this guidance to all built pages.`;
  }
  if (!input.selectedVariant) return "";
  const v = input.selectedVariant;
  const palette = v.preview.palette.join(", ");
  return [
    `Selected design variant: ${v.label}`,
    `Description: ${v.description}`,
    `Palette: ${palette}`,
    `Font: ${v.preview.font}`,
    `Motion intensity: ${v.preview.motion}`,
    v.preview.density !== undefined ? `Density hint: ${v.preview.density}` : "",
    "",
    "Apply this variant's palette and typography across all built pages.",
  ]
    .filter(Boolean)
    .join("\n");
}
