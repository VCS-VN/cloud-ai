import type { OpenAIProvider } from "../../openai/openai-provider.server";
import { designDialsSchema } from "../../openai/schemas";
import type { WebsiteSpec } from "../../project/project-state.schema";
import {
  DESIGN_DIAL_BOUNDS,
  RADIUS_LOCK_VALUES,
  THEME_LOCK_VALUES,
  type DesignDials,
} from "./design-token-schema.server";

export type GenerateDialsInput = {
  websiteSpec: WebsiteSpec;
  userPrompt: string;
  provider?: OpenAIProvider;
  model?: string;
};

const COLOR_LOCK_RULE =
  "use only declared palette roles (primary, accent, highlight, deep) — no off-palette ad-hoc colors";

/**
 * Clamp dials to the commerce ceiling. Deterministic and pure so it can be unit-tested
 * independently of the LLM. The taste-skill baseline (8/6/4) skews artsy/cinematic;
 * retail storefronts prioritise shopping actions, so motion is capped hard.
 */
export function clampDials(raw: {
  variance: number;
  motion: number;
  density: number;
}): { variance: number; motion: number; density: number } {
  const clamp = (value: number, key: keyof typeof DESIGN_DIAL_BOUNDS) => {
    const { min, max } = DESIGN_DIAL_BOUNDS[key];
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, Math.round(value)));
  };
  return {
    variance: clamp(raw.variance, "variance"),
    motion: clamp(raw.motion, "motion"),
    density: clamp(raw.density, "density"),
  };
}

function normalizeLocks(raw: {
  radiusLock?: unknown;
  themeLock?: unknown;
}): { radiusLock: DesignDials["radiusLock"]; themeLock: DesignDials["themeLock"] } {
  const radiusLock = RADIUS_LOCK_VALUES.includes(raw.radiusLock as never)
    ? (raw.radiusLock as DesignDials["radiusLock"])
    : "all-soft";
  const themeLock = THEME_LOCK_VALUES.includes(raw.themeLock as never)
    ? (raw.themeLock as DesignDials["themeLock"])
    : "dual";
  return { radiusLock, themeLock };
}

/**
 * Heuristic fallback when no provider is configured. Maps brand tone to dials using
 * the distilled Dial Inference table, then clamps. Deterministic.
 */
export function fallbackDials(spec: WebsiteSpec): DesignDials {
  const tone = spec.brand.tone;
  const byTone: Record<string, { variance: number; motion: number; density: number; radiusLock: DesignDials["radiusLock"] }> = {
    minimal: { variance: 5, motion: 3, density: 3, radiusLock: "all-sharp" },
    premium: { variance: 7, motion: 5, density: 3, radiusLock: "all-soft" },
    luxury: { variance: 7, motion: 4, density: 3, radiusLock: "all-sharp" },
    friendly: { variance: 6, motion: 4, density: 4, radiusLock: "all-soft" },
    playful: { variance: 8, motion: 5, density: 4, radiusLock: "all-pill" },
    bold: { variance: 8, motion: 5, density: 4, radiusLock: "all-sharp" },
    streetwear: { variance: 8, motion: 5, density: 4, radiusLock: "all-sharp" },
    organic: { variance: 6, motion: 3, density: 4, radiusLock: "all-soft" },
    tech: { variance: 6, motion: 4, density: 5, radiusLock: "all-sharp" },
  };
  const base = byTone[tone] ?? byTone.friendly;
  const clamped = clampDials(base);
  return {
    ...clamped,
    designRead: `Reading this as: ${normalizeCategory(spec)} storefront for ${normalizeAudience(spec)}, with a ${tone} retail language.`,
    colorLock: COLOR_LOCK_RULE,
    radiusLock: base.radiusLock,
    themeLock: "dual",
  };
}

function buildSystemPrompt(): string {
  return `You set the design "dials" and "locks" for a RETAIL E-COMMERCE STOREFRONT, distilled from an anti-slop frontend taste system.

First, read the room and output a one-line Design Read: "Reading this as: <retail category> storefront for <audience>, with a <vibe> retail language."

Then choose three dials on a 1-10 scale using this inference table, biased for commerce:
- minimalist / clean / calm / editorial: variance 5-6, motion 3-4, density 2-3
- premium consumer / luxury / brand: variance 7-8, motion 4-5, density 3-4
- playful / bold / streetwear / experimental: variance 8, motion 4-5, density 4
- trust-first / regulated / accessibility-critical: variance 3-4, motion 2-3, density 4-5

This is a storefront that SELLS PRODUCTS, never an agency showcase. Keep motion restrained so it never competes with shopping actions. Prefer shopping clarity over spectacle.

Also choose three locks:
- colorLock: always "${COLOR_LOCK_RULE}".
- radiusLock: one of all-sharp, all-soft, all-pill — one corner-radius system for the whole storefront.
- themeLock: one of light, dark, dual. Prefer "dual" (light + dark) unless the vibe strongly demands a single theme.

Return integers for the dials.`;
}

/**
 * Generate the design dials/locks/read for a project. Uses the provider when available
 * (structured output), otherwise a deterministic tone-based fallback. Always clamps.
 */
export async function generateDesignDials(input: GenerateDialsInput): Promise<DesignDials> {
  if (!input.provider || !input.model) {
    return fallbackDials(input.websiteSpec);
  }

  try {
    const raw = await input.provider.parseStructured<
      { prompt: string; store: unknown; brand: unknown },
      {
        designRead: string;
        variance: number;
        motion: number;
        density: number;
        colorLock: string;
        radiusLock: string;
        themeLock: string;
      }
    >({
      model: input.model,
      system: buildSystemPrompt(),
      user: {
        prompt: input.userPrompt,
        store: {
          name: input.websiteSpec.store.name,
          type: input.websiteSpec.store.type,
          description: input.websiteSpec.store.description,
          targetCustomers: input.websiteSpec.store.targetCustomers,
        },
        brand: { tone: input.websiteSpec.brand.tone, visualStyle: input.websiteSpec.brand.visualStyle },
      },
      schemaName: "design_dials",
      schema: designDialsSchema,
      allowFreeFormFallback: true,
    });

    const clamped = clampDials(raw);
    const locks = normalizeLocks(raw);
    return {
      ...clamped,
      designRead:
        typeof raw.designRead === "string" && raw.designRead.trim()
          ? raw.designRead.trim().slice(0, 200)
          : fallbackDials(input.websiteSpec).designRead,
      colorLock: COLOR_LOCK_RULE,
      radiusLock: locks.radiusLock,
      themeLock: locks.themeLock,
    };
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "generate_design_dials_failed_using_fallback",
        model: input.model,
        error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
      }),
    );
    return fallbackDials(input.websiteSpec);
  }
}

function normalizeCategory(spec: WebsiteSpec): string {
  const type = spec.store.type;
  return typeof type === "string" && type.trim() ? type.trim() : "retail";
}

function normalizeAudience(spec: WebsiteSpec): string {
  const audience = spec.store.targetCustomers;
  if (Array.isArray(audience)) {
    const joined = audience.filter(Boolean).join(", ");
    if (joined) return joined;
  }
  return "retail shoppers";
}
