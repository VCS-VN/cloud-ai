import { describe, it, expect } from "vitest";
import {
  INIT_BATCH_FILE_CAP,
  planInitBatches,
  stripBlockedFromBatches,
  validatePlan,
  type ManifestSource,
} from "@/features/agents/codex/runtime/init-batch-planner.server";

const FULL_MANIFEST: ManifestSource = {
  layers: [
    { marker: "PACKAGES", file: "data/packages.md", order: 30 },
    { marker: "PROVIDER", file: "data/provider.md", order: 40 },
    { marker: "CATALOG_DATA", file: "data/catalog-data.md", order: 45 },
    { marker: "DATA", file: "data/data.md", order: 50 },
    { marker: "COMPONENT", file: "data/component.md", order: 60 },
    { marker: "HOME_PAGE", file: "pages/home.md", order: 70 },
    { marker: "PRODUCTS_PAGE", file: "pages/products.md", order: 80 },
    { marker: "PRODUCT_DETAIL_PAGE", file: "pages/product-detail.md", order: 90 },
    { marker: "CART_PAGE", file: "pages/cart.md", order: 100 },
    { marker: "CHECKOUT_PAGE", file: "pages/checkout.md", order: 110 },
    { marker: "ORDERS_PAGE", file: "pages/orders.md", order: 120 },
    { marker: "ORDER_DETAIL_PAGE", file: "pages/order-detail.md", order: 130 },
  ],
};

describe("init-batch-planner", () => {
  it("orders foundation_data first, then pages, then polish", async () => {
    const plan = await planInitBatches({ manifest: FULL_MANIFEST });
    const kinds = plan.batches.map((b) => b.kind);
    expect(kinds[0]).toBe("foundation_data");
    expect(kinds[kinds.length - 1]).toBe("polish");
    const pageRange = kinds.slice(1, -1);
    for (const kind of pageRange) expect(kind).toBe("page");
  });

  it("includes all 7 page batches in manifest order", async () => {
    const plan = await planInitBatches({ manifest: FULL_MANIFEST });
    const pageMarkers = plan.batches
      .filter((b) => b.kind === "page")
      .map((b) => b.marker);
    expect(pageMarkers).toEqual([
      "HOME_PAGE",
      "PRODUCTS_PAGE",
      "PRODUCT_DETAIL_PAGE",
      "CART_PAGE",
      "CHECKOUT_PAGE",
      "ORDERS_PAGE",
      "ORDER_DETAIL_PAGE",
    ]);
  });

  it("rejects a plan with a batch larger than the cap", () => {
    const oversized = Array.from({ length: INIT_BATCH_FILE_CAP + 1 }, (_, i) => `src/components/Item${i}.tsx`);
    const result = validatePlan({
      batches: [{ kind: "foundation_data", marker: "FOUNDATION_DATA", files: oversized, specPaths: [] }],
      totalFiles: oversized.length,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("batch_too_large");
  });

  it("rejects a plan that touches a blocked path", () => {
    const result = validatePlan({
      batches: [
        {
          kind: "foundation_data",
          marker: "FOUNDATION_DATA",
          files: ["src/components/Hero.tsx", "package.json"],
          specPaths: [],
        },
      ],
      totalFiles: 2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("blocked_path");
      expect(result.offending).toBe("package.json");
    }
  });

  it("accepts a clean plan", async () => {
    const plan = await planInitBatches({ manifest: FULL_MANIFEST });
    const result = validatePlan(plan);
    expect(result.ok).toBe(true);
  });

  it("carries each page's manifest spec path onto its batch", async () => {
    const plan = await planInitBatches({ manifest: FULL_MANIFEST });
    const home = plan.batches.find((b) => b.marker === "HOME_PAGE");
    expect(home?.specPaths).toEqual(["pages/home.md"]);
  });

  it("aggregates all foundation spec paths onto the foundation batch", async () => {
    const plan = await planInitBatches({ manifest: FULL_MANIFEST });
    const foundation = plan.batches.find((b) => b.kind === "foundation_data");
    expect(foundation?.specPaths).toEqual([
      "data/packages.md",
      "data/provider.md",
      "data/catalog-data.md",
      "data/data.md",
      "data/component.md",
    ]);
  });

  it("stripBlockedFromBatches removes blocked files but keeps allowed ones", () => {
    const stripped = stripBlockedFromBatches({
      batches: [
        {
          kind: "page",
          marker: "HOME_PAGE",
          files: ["src/routes/index.tsx", "package.json", "vite.config.ts"],
          specPaths: [],
        },
      ],
      totalFiles: 3,
    });
    expect(stripped.batches[0].files).toEqual(["src/routes/index.tsx"]);
    expect(stripped.totalFiles).toBe(1);
  });
});
