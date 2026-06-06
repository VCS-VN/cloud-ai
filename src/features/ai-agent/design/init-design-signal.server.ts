import type { WebsiteSpec } from "@/features/projects/legacy/project-state.schema";
import {
  normalizeStoreTypeForTemplate,
  type StoreVertical,
} from "@/features/generated-projects/legacy/template-registry.server";

export type InitDesignPipelineSignal = {
  primaryCategoryId: string;
  subcategoryId: string | null;
  archetype: string | null;
  priceTier: "value" | "mainstream" | "premium" | "luxury" | null;
  promptText: string;
  websiteSpec: { name?: string; products?: string[] };
};

function storeVerticalToPrimaryCategory(vertical: StoreVertical): string {
  switch (vertical) {
    case "fashion":
      return "fashion-apparel";
    case "cosmetics":
    case "nail":
      return "beauty-personal-care";
    case "electronics":
      return "audio-electronics";
    case "grocery":
    case "food":
      return "food-beverage";
    case "furniture":
      return "home-living";
    default:
      return "fashion-apparel";
  }
}

function inferSubcategoryId(
  vertical: StoreVertical,
  spec: WebsiteSpec,
): string | null {
  switch (vertical) {
    case "fashion":
      return "streetwear";
    case "cosmetics":
      return "skincare";
    case "nail":
      return "wellness";
    case "electronics":
      return "accessories-tech";
    case "grocery":
    case "food":
      return "pantry-staples";
    default:
      return null;
  }
}

function inferPriceTier(
  tone: WebsiteSpec["brand"]["tone"],
): InitDesignPipelineSignal["priceTier"] {
  if (tone === "luxury" || tone === "premium") return "premium";
  if (tone === "minimal" || tone === "friendly" || tone === "organic")
    return "mainstream";
  if (tone === "playful" || tone === "streetwear") return "value";
  return "mainstream";
}

export function buildInitDesignPipelineSignal(
  spec: WebsiteSpec,
  promptText: string,
): InitDesignPipelineSignal {
  const vertical = normalizeStoreTypeForTemplate(spec.store.type);
  return {
    primaryCategoryId: storeVerticalToPrimaryCategory(vertical),
    subcategoryId: inferSubcategoryId(vertical, spec),
    archetype: null,
    priceTier: inferPriceTier(spec.brand.tone),
    promptText,
    websiteSpec: {
      name: spec.store.name,
      products: spec.products.map((p) => p.name),
    },
  };
}
