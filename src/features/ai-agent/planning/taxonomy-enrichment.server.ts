import {
  loadCategoryTaxonomy,
  type LoaderOverrides,
} from "@/features/ai-agent/design/library-loader.server";

export type EnrichedSignal = {
  primaryCategoryId: string;
  subcategoryId: string | null;
  archetype: string | null;
  priceTier: "value" | "mainstream" | "premium" | "luxury" | null;
  promptText: string;
  websiteSpec: { name?: string; products?: string[] };
  taxonomyStatus: "found" | "soft-miss";
};

export type RawSignal = Omit<EnrichedSignal, "taxonomyStatus">;

export async function enrichTaxonomy(
  signal: RawSignal,
  overrides: LoaderOverrides = {},
): Promise<EnrichedSignal> {
  const taxonomy = await loadCategoryTaxonomy(overrides);
  const primary = taxonomy.primary.find((p) => p.id === signal.primaryCategoryId);
  if (!primary) {
    throw Object.assign(new Error(`Unknown primary category: ${signal.primaryCategoryId}`), {
      code: "DESIGN_TAXONOMY_FAIL",
    });
  }
  if (!signal.subcategoryId) {
    return { ...signal, taxonomyStatus: "found" };
  }
  const sub = primary.subcategories.find((s) => s.id === signal.subcategoryId);
  if (!sub) {
    return { ...signal, subcategoryId: null, taxonomyStatus: "soft-miss" };
  }
  return { ...signal, taxonomyStatus: "found" };
}
