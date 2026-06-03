import type { Vibe } from "./blocks-manifest";
import type { TemplateId } from "../source/template-registry.server";

/**
 * Init-time vibe anchors aligned with vertical layout-spec allowed variants.
 * Category heuristics (e.g. food-beverage → retro) can disagree with filtered blocks.
 */
const INIT_VIBE_ANCHOR_BY_TEMPLATE: Record<TemplateId, string> = {
  "ecommerce-fashion": "editorial",
  "ecommerce-cosmetics": "organic-natural",
  "ecommerce-nail": "friendly-approachable",
  "ecommerce-electronics": "tech-cyber",
  "ecommerce-grocery": "organic-natural",
  "ecommerce-basic": "editorial",
  "ecommerce-single-product": "minimalist",
};

export function alignVibeAnchorsForInitTemplate(
  vibe: Vibe,
  templateId: TemplateId | undefined,
): Vibe {
  if (!templateId) return vibe;
  const anchor = INIT_VIBE_ANCHOR_BY_TEMPLATE[templateId];
  if (!anchor) return vibe;
  return { ...vibe, anchors: [anchor] };
}
