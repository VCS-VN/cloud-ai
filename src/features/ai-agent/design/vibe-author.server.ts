import {
  loadReferencePool,
  type LoaderOverrides,
} from "@/features/ai-agent/design/library-loader.server";
import type { Vibe } from "@/features/ai-agent/design/blocks-manifest";
import type { EnrichedSignal } from "@/features/ai-agent/planning/taxonomy-enrichment.server";

export type VibeAuthorInput = {
  signal: EnrichedSignal;
};

export type VibeAuthorFn = (input: VibeAuthorInput) => Promise<Vibe>;

export type VibeAuthorOptions = {
  pickFewShot?: number;
  loaderOverrides?: LoaderOverrides;
};

function pickReferencePoolFewShot(
  pool: Awaited<ReturnType<typeof loadReferencePool>>,
  signal: EnrichedSignal,
  count: number,
) {
  const examples = pool.examples
    .map((ex) => {
      const overlap = ex.applicableCategories.includes(signal.primaryCategoryId) ? 1 : 0;
      return { ex, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap || a.ex.id.localeCompare(b.ex.id))
    .slice(0, count)
    .map((entry) => entry.ex);
  return examples;
}

const HEURISTIC_DESCRIPTORS: Record<string, { descriptor: string; anchor: string; story: string }> = {
  "fashion-apparel": {
    descriptor: "Editorial monochrome with confident serif headlines on warm canvas surfaces.",
    anchor: "editorial",
    story:
      "Two-column body holds long-form copy; product cards behave like museum captions and the cart is a side panel that disappears between visits.",
  },
  "home-living": {
    descriptor: "Calm gallery layout with restrained palette and confident vertical rhythm.",
    anchor: "minimalist",
    story:
      "Wide whitespace anchors each section; hero photo is a single styled vignette and the page returns to white canvas between every two color blocks.",
  },
  "beauty-personal-care": {
    descriptor: "Apothecary heritage with botanical hand-cut labels on warm sand surfaces.",
    anchor: "organic-natural",
    story:
      "Etched plant illustrations frame the hero; ingredient call-outs lead the conversion path and trust signals are sourcing notes rather than badges.",
  },
  "food-beverage": {
    descriptor: "Pantry-label palette with hand-set headlines and warm cream surfaces.",
    anchor: "retro",
    story:
      "Mustard, brick, and sage applied as big flat shapes; copy reads like a friendly note from the founder and trust signals quote pantry-shelf customers.",
  },
  "audio-electronics": {
    descriptor: "Console-grade neutrals with monospaced microcopy and hairline-only ornaments.",
    anchor: "tech-cyber",
    story:
      "Spec lines lead each product card; promo bands look like update logs and the cart is treated as a transaction terminal.",
  },
  "kids-toys": {
    descriptor: "Sticker-stack hero with hand-drawn outlines and warm primary color blocks.",
    anchor: "playful",
    story:
      "Cards rotate slightly off-axis; copy uses you/we voice and trust signals are parent quotes paired with photos of the child engaged with the toy.",
  },
  "pets": {
    descriptor: "Soft pastel rounds with chatty conversational copy on warm canvas surfaces.",
    anchor: "friendly-approachable",
    story:
      "Rounded cards and warm pinks set the tone; trust signals lean on customer voicemails and pet photos, never on cold percentage badges.",
  },
  "jewelry-watches": {
    descriptor: "Museum-pace ivory surfaces with serif display headlines and slow scroll.",
    anchor: "luxury",
    story:
      "Wide gutters and a single product per fold; copy reads like an auction catalog and the CTA is whisper-quiet but always present.",
  },
  "books-media": {
    descriptor: "Bookstore window display with ribbon eyebrows and serif drop caps.",
    anchor: "editorial",
    story:
      "Two-column body holds reads; product cards behave like catalog cards from a 70s mail-order house and trust signals are press quotes set in italic serif.",
  },
  "outdoor-gear": {
    descriptor: "Field-tested neutrals with mono spec labels and rugged photography.",
    anchor: "tech-cyber",
    story:
      "Hairline-only tables, mono spec labels, single product per fold; trust signals are field test notes, never abstract badges.",
  },
  "wellness-supplements": {
    descriptor: "Apothecary calm with botanical etchings on aged ivory surfaces.",
    anchor: "organic-natural",
    story:
      "Etched plant illustrations and italic serif eyebrows; ingredient roll-call leads conversion and trust signals are sourcing notes from the maker.",
  },
  "gourmet-specialty": {
    descriptor: "Pantry serif with botanical etching headlines on warm canvas surfaces.",
    anchor: "refined-classic",
    story:
      "Recipe-card pacing across the page; product cards include preparation notes and trust signals are chef quotes rather than star ratings.",
  },
  "digital-goods": {
    descriptor: "System-prompt hairlines on cool neutral surfaces with monospaced microcopy.",
    anchor: "tech-cyber",
    story:
      "Mono eyebrows label each section; product cards present specs first and the cart reads like a transaction terminal with quiet status messaging.",
  },
  "subscription-boxes": {
    descriptor: "Pantry-shelf palette with hand-set headlines and friendly rounded radii.",
    anchor: "friendly-approachable",
    story:
      "Cream and dusty pink surfaces; copy reads like a friendly note describing what arrives in the box and trust signals are unboxing photos from members.",
  },
  "garden-plants": {
    descriptor: "Sage and clay surfaces with botanical hand-drawn motifs framing the hero.",
    anchor: "organic-natural",
    story:
      "Plant illustrations bracket every section; trust signals lead with grower bios and the cart wears a soft botanical edge that fits the page tone.",
  },
  "travel-luggage": {
    descriptor: "Soft warm canvas with serif greetings and rounded radii on travel photography.",
    anchor: "refined-classic",
    story:
      "Ivory surfaces and friendly serif headlines; trust signals are concierge-style notes and the product grid behaves like a curated destination guide.",
  },
  "sports-outdoors": {
    descriptor: "Drop-cycle hero with field-tested eyebrow labels and saturated color blocks.",
    anchor: "streetwear",
    story:
      "Saturated brand color in big shapes, full-bleed product photos, eyebrows reading as gear-spec; cart wears a hard chrome edge for intent.",
  },
  "stationery-craft": {
    descriptor: "Pencil-stroke headlines on raw canvas backgrounds with mixed type weights.",
    anchor: "handcrafted",
    story:
      "Imperfect borders and ingredient or material cards; CTA buttons feel hand-cut and trust signals are letters from the maker rather than badges.",
  },
};

export function fallbackVibe(signal: EnrichedSignal): Vibe {
  const fb = HEURISTIC_DESCRIPTORS[signal.primaryCategoryId];
  if (fb) {
    return { descriptor: fb.descriptor, anchors: [fb.anchor], story: fb.story };
  }
  return {
    descriptor: "Calm editorial surfaces with confident serif headlines on warm canvas.",
    anchors: ["editorial"],
    story:
      "Two-column body holds long-form copy; product cards behave like museum captions and the cart is a side panel that disappears between visits.",
  };
}

const ANCHOR_ID_REGEX = /^[a-z][a-z0-9-]*$/;

export function validateVibe(
  vibe: Vibe,
  knownAnchors: ReadonlySet<string>,
): { ok: true } | { ok: false; reason: string } {
  if (!vibe.descriptor || vibe.descriptor.length < 1 || vibe.descriptor.length > 200) {
    return { ok: false, reason: "descriptor length out of bounds" };
  }
  if (!Array.isArray(vibe.anchors) || vibe.anchors.length < 1 || vibe.anchors.length > 2) {
    return { ok: false, reason: "anchors must contain 1-2 entries" };
  }
  for (const anchor of vibe.anchors) {
    if (!ANCHOR_ID_REGEX.test(anchor)) {
      return { ok: false, reason: `anchor ${anchor} not kebab-case` };
    }
    if (!knownAnchors.has(anchor)) {
      return { ok: false, reason: `anchor ${anchor} not in bounded list` };
    }
  }
  if (!vibe.story || vibe.story.length < 1 || vibe.story.length > 600) {
    return { ok: false, reason: "story length out of bounds" };
  }
  return { ok: true };
}

export async function authorVibe(
  signal: EnrichedSignal,
  authorFn: VibeAuthorFn | undefined,
  options: VibeAuthorOptions = {},
): Promise<{ vibe: Vibe; usedFallback: boolean }> {
  const pool = await loadReferencePool(options.loaderOverrides);
  const knownAnchors = new Set(pool.anchors.map((a) => a.id));
  const fewShot = pickReferencePoolFewShot(pool, signal, options.pickFewShot ?? 3);

  if (!authorFn) {
    return { vibe: fallbackVibe(signal), usedFallback: true };
  }

  const attempt = async (): Promise<Vibe | null> => {
    try {
      const vibe = await authorFn({ signal });
      const check = validateVibe(vibe, knownAnchors);
      return check.ok ? vibe : null;
    } catch {
      return null;
    }
  };

  // No-op use of fewShot to avoid unused warning; future: pass into authorFn as hint.
  void fewShot;

  let vibe = await attempt();
  if (!vibe) {
    vibe = await attempt();
  }
  if (!vibe) {
    return { vibe: fallbackVibe(signal), usedFallback: true };
  }
  return { vibe, usedFallback: false };
}
