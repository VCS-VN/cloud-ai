import { z } from "zod";
import {
  isPrivacySafe,
} from "@/server/functions/progress-mapper.server";
import type { DesignVariant } from "@/shared/project-types";

const HEX_PATTERN = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const designVariantSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(30),
  description: z
    .string()
    .min(1)
    .max(120)
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

function tryParseVariants(rawResponse: string): DesignVariantValidationResult {
  let json: unknown;
  try {
    json = JSON.parse(rawResponse);
  } catch {
    return { ok: false, reason: "invalid JSON" };
  }
  // Allow the model to wrap the array in an object: { variants: [...] }
  if (Array.isArray(json)) return validateDesignVariants(json);
  if (json && typeof json === "object" && Array.isArray((json as { variants?: unknown }).variants)) {
    return validateDesignVariants((json as { variants: unknown[] }).variants);
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
