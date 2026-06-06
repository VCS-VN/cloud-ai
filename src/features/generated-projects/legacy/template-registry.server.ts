import type { WebsiteSpec } from "@/features/projects/legacy/project-state.schema";

export type TemplateId =
  | "ecommerce-basic"
  | "ecommerce-fashion"
  | "ecommerce-electronics"
  | "ecommerce-cosmetics"
  | "ecommerce-grocery"
  | "ecommerce-nail"
  | "ecommerce-single-product";

export type StoreVertical =
  | "fashion"
  | "electronics"
  | "cosmetics"
  | "grocery"
  | "nail"
  | "food"
  | "furniture"
  | "single-product"
  | "general";

export function normalizeStoreTypeForTemplate(
  type: WebsiteSpec["store"]["type"] | string,
): StoreVertical {
  const value = String(type);
  if (value === "food") return "grocery";
  return value as StoreVertical;
}

export function selectTemplate(spec: WebsiteSpec): TemplateId {
  const type = normalizeStoreTypeForTemplate(spec.store.type);
  switch (type) {
    case "fashion":
      return "ecommerce-fashion";
    case "electronics":
      return "ecommerce-electronics";
    case "cosmetics":
      return "ecommerce-cosmetics";
    case "grocery":
      return "ecommerce-grocery";
    case "nail":
      return "ecommerce-nail";
    case "single-product":
      return "ecommerce-single-product";
    default:
      return "ecommerce-basic";
  }
}

export function slugifyProjectName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ai-storefront";
}
