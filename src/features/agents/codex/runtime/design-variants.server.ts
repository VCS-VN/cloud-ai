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
  | { ok: true; variants: DesignVariant[]; rawResponse: string }
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

function normalizeVariantShape(raw: unknown): unknown {
  // Tolerate model field-name drift: accept both `label`/`name` and
  // `id`/`vibe`. Also auto-truncate `description` to 240 chars before
  // validation, since Vietnamese prose tends to overshoot tighter limits.
  if (Array.isArray(raw)) return raw.map(normalizeVariantShape);
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.variants)) {
    return { variants: (obj.variants as unknown[]).map(normalizeVariantShape) };
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
  return reshape;
}

function tryParseVariants(rawResponse: string): DesignVariantValidationResult {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFence(rawResponse));
  } catch {
    return { ok: false, reason: "invalid JSON" };
  }
  const normalized = normalizeVariantShape(json);
  // Allow the model to wrap the array in an object: { variants: [...] }
  if (Array.isArray(normalized)) return validateDesignVariants(normalized);
  if (
    normalized &&
    typeof normalized === "object" &&
    Array.isArray((normalized as { variants?: unknown }).variants)
  ) {
    return validateDesignVariants((normalized as { variants: unknown[] }).variants);
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
      return { ok: true, variants: validation.variants, rawResponse: turn.finalResponse };
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
