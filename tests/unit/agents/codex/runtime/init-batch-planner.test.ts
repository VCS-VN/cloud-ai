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
    {
      marker: "PRODUCT_DETAIL_PAGE",
      file: "pages/product-detail.md",
      order: 90,
    },
    { marker: "CART_PAGE", file: "pages/cart.md", order: 100 },
    { marker: "CHECKOUT_PAGE", file: "pages/checkout.md", order: 110 },
    { marker: "ORDERS_PAGE", file: "pages/orders.md", order: 120 },
    { marker: "ORDER_DETAIL_PAGE", file: "pages/order-detail.md", order: 130 },
  ],
};

describe("init-batch-planner", () => {
  it("emits only foundation_data phases (DESIGN_DOC, COMPONENTS); no page/polish batches", async () => {
    const plan = await planInitBatches({ manifest: FULL_MANIFEST });
    const kinds = plan.batches.map((b) => b.kind);
    expect(kinds[0]).toBe("foundation_data");
    expect(kinds).not.toContain("page");
    expect(kinds).not.toContain("polish");
    for (const kind of kinds) expect(kind).toBe("foundation_data");
  });

  it("emits only the agent-authored phases (DESIGN_DOC, COMPONENTS); plumbing is seeded", async () => {
    const plan = await planInitBatches({ manifest: FULL_MANIFEST });
    const foundationMarkers = plan.batches
      .filter((b) => b.kind === "foundation_data")
      .map((b) => b.marker);
    expect(foundationMarkers).toEqual(["DESIGN_DOC", "COMPONENTS"]);
  });

  it("places DESIGN_DOC before COMPONENTS (components honor the design doc)", async () => {
    const plan = await planInitBatches({ manifest: FULL_MANIFEST });
    const markers = plan.batches.map((b) => b.marker);
    expect(markers.indexOf("DESIGN_DOC")).toBeLessThan(
      markers.indexOf("COMPONENTS"),
    );
  });

  it("does NOT put seeded plumbing (data entities, hooks, providers) in agent batches", async () => {
    const plan = await planInitBatches({ manifest: FULL_MANIFEST });
    const files = plan.batches.flatMap((b) => b.files);
    // These are now runtime-seeded — the agent must not be asked to write them.
    expect(files).not.toContain("src/data/products.ts");
    expect(files).not.toContain("src/lib/format-money.ts");
    expect(files).not.toContain("src/app/store-provider.tsx");
    for (const hook of [
      "use-store-detail",
      "use-products-list",
      "use-product-detail",
      "use-categories-list",
      "use-product-suggestions",
    ]) {
      expect(files).not.toContain(`src/services/store/${hook}.ts`);
    }
    // Components remain agent work, at the nested layout/ + store/ paths.
    expect(files).toContain("src/components/layout/site-header.tsx");
    expect(files).not.toContain("src/components/SiteHeader.tsx");
  });

  it("emits ONLY the home route; other commerce routes are seeded runtime-owned", async () => {
    const plan = await planInitBatches({ manifest: FULL_MANIFEST });
    const pageBatches = plan.batches.filter((b) => b.kind === "page");
    expect(pageBatches).toHaveLength(0);
    const files = plan.batches.flatMap((b) => b.files);
    // Home is the one route the agent authors.
    expect(files).toContain("src/routes/index.tsx");
    // The remaining commerce routes are pre-seeded and must NOT be agent batches.
    for (const route of [
      "src/routes/products/index.tsx",
      "src/routes/products/$productId.tsx",
      "src/routes/cart.tsx",
      "src/routes/checkout.tsx",
      "src/routes/orders.tsx",
      "src/routes/orders/$orderId.tsx",
    ]) {
      expect(files).not.toContain(route);
    }
  });

  it("rejects a plan with a batch larger than the cap", () => {
    const oversized = Array.from(
      { length: INIT_BATCH_FILE_CAP + 1 },
      (_, i) => `src/components/Item${i}.tsx`,
    );
    const result = validatePlan({
      batches: [
        {
          kind: "foundation_data",
          marker: "FOUNDATION_DATA",
          files: oversized,
          specPaths: [],
        },
      ],
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

  it("carries the matching spec path onto each foundation phase batch", async () => {
    const plan = await planInitBatches({ manifest: FULL_MANIFEST });
    const specByMarker = Object.fromEntries(
      plan.batches
        .filter((b) => b.kind === "foundation_data")
        .map((b) => [b.marker, b.specPaths]),
    );
    // Only DESIGN_DOC + COMPONENTS remain for the agent; all fixed plumbing
    // (data entities, lib helpers, hooks, providers) is seeded before the loop.
    expect(specByMarker.COMPONENTS).toEqual(["data/component.md", "pages/home.md"]);
    // DESIGN_DOC has no separate spec body (rules inline in system.md).
    expect(specByMarker.DESIGN_DOC).toEqual([]);
    // The seeded phases must NOT appear as agent batches anymore.
    expect(specByMarker.DATA_ENTITIES).toBeUndefined();
    expect(specByMarker.LIB_PROVIDERS).toBeUndefined();
    expect(specByMarker.HOOKS).toBeUndefined();
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
