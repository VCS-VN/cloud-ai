import type { WebsiteSpec } from "../project/project-state.schema";

export type TemplateId = "ecommerce-basic" | "ecommerce-fashion" | "ecommerce-electronics" | "ecommerce-cosmetics" | "ecommerce-single-product";

export function selectTemplate(spec: WebsiteSpec): TemplateId {
  switch (spec.store.type) {
    case "fashion": return "ecommerce-fashion";
    case "electronics": return "ecommerce-electronics";
    case "cosmetics": return "ecommerce-cosmetics";
    case "single-product": return "ecommerce-single-product";
    default: return "ecommerce-basic";
  }
}

export function slugifyProjectName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ai-storefront";
}
