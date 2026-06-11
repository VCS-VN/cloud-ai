import fs from "node:fs/promises";
import path from "node:path";
import { isBlockedProjectPath } from "@/features/agents/codex/boundary/protected-paths";

export type InitBatchKind = "foundation_data" | "page" | "polish";

export type InitBatch = {
  kind: InitBatchKind;
  marker: string;
  files: string[];
  // Manifest-relative spec paths (e.g. "data/packages.md", "pages/home.md")
  // whose bodies describe HOW to author the files in scope. The driver loads
  // these and appends them to the batch prompt so the agent receives the
  // per-file authoring contract, not just a list of paths.
  specPaths: string[];
};

export type InitBatchPlan = {
  batches: InitBatch[];
  totalFiles: number;
};

export const INIT_BATCH_FILE_CAP = 40;
export const FOUNDATION_BATCH_MARKER = "FOUNDATION_DATA";
export const POLISH_BATCH_MARKER = "POLISH";

const POLISH_PLACEHOLDER = "src/styles/polish.css";

type ManifestEntry = {
  marker: string;
  order: number;
  file?: string;
  type?: "dynamic";
};

const FOUNDATION_MARKERS = new Set([
  "PACKAGES",
  "PROVIDER",
  "CATALOG_DATA",
  "DATA",
  "COMPONENT",
]);

const PAGE_MARKER_TO_FILES: Record<string, string[]> = {
  HOME_PAGE: ["src/routes/index.tsx"],
  PRODUCTS_PAGE: ["src/routes/products/index.tsx"],
  PRODUCT_DETAIL_PAGE: ["src/routes/products/$productId.tsx"],
  CART_PAGE: ["src/routes/cart.tsx"],
  CHECKOUT_PAGE: ["src/routes/checkout.tsx"],
  ORDERS_PAGE: ["src/routes/orders.tsx"],
  ORDER_DETAIL_PAGE: ["src/routes/orders/$orderId.tsx"],
};

const FOUNDATION_MARKER_TO_FILES: Record<string, string[]> = {
  PACKAGES: ["src/lib/format-money.ts"],
  PROVIDER: [
    "src/app/store-provider.tsx",
    "src/app/cart-provider.tsx",
    "src/app/auth-provider.tsx",
  ],
  CATALOG_DATA: ["src/data/sample-store.ts"],
  DATA: [
    "src/shared/sample-data/products.ts",
    "src/shared/sample-data/categories.ts",
  ],
  COMPONENT: ["src/components/SiteHeader.tsx", "src/components/SiteFooter.tsx"],
};

export type ManifestSource = { layers?: ManifestEntry[] };

const INIT_TEMPLATES_DIR = "templates/codex-builder/init";

async function readManifest(): Promise<ManifestSource> {
  const target = path.resolve(process.cwd(), INIT_TEMPLATES_DIR, "manifest.json");
  const raw = await fs.readFile(target, "utf8");
  return JSON.parse(raw) as ManifestSource;
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith("---\n")) return content;
  const end = content.indexOf("\n---", 4);
  if (end === -1) return content;
  return content.slice(end + 4).replace(/^\n+/, "");
}

/**
 * Load the manifest spec bodies for a batch (frontmatter stripped). The spec
 * `.md` files describe HOW to author each file in scope — the per-file
 * authoring contract the agent needs. Paths are manifest-relative (e.g.
 * "pages/home.md") and resolved under the init templates dir. A missing or
 * unreadable spec is skipped (logged) rather than failing the run, since the
 * file list itself is still valid.
 */
export async function loadBatchSpecs(specPaths: string[]): Promise<string[]> {
  const bodies: string[] = [];
  for (const rel of specPaths) {
    try {
      const abs = path.resolve(process.cwd(), INIT_TEMPLATES_DIR, rel);
      const raw = await fs.readFile(abs, "utf8");
      const body = stripFrontmatter(raw).trim();
      if (body) bodies.push(body);
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "init_batch_spec_load_failed",
          specPath: rel,
          error: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
  }
  return bodies;
}

export type PlanBuildInput = {
  manifest?: ManifestSource;
  pagesOnly?: boolean;
};

export async function planInitBatches(
  input: PlanBuildInput = {},
): Promise<InitBatchPlan> {
  const manifest = input.manifest ?? (await readManifest());
  const layers = (manifest.layers ?? [])
    .slice()
    .sort((a, b) => a.order - b.order);

  const foundationFiles: string[] = [];
  const foundationSpecPaths: string[] = [];
  const pageBatches: InitBatch[] = [];

  for (const layer of layers) {
    if (FOUNDATION_MARKERS.has(layer.marker)) {
      const files = FOUNDATION_MARKER_TO_FILES[layer.marker] ?? [];
      foundationFiles.push(...files);
      if (layer.file) foundationSpecPaths.push(layer.file);
      continue;
    }
    if (PAGE_MARKER_TO_FILES[layer.marker]) {
      pageBatches.push({
        kind: "page",
        marker: layer.marker,
        files: PAGE_MARKER_TO_FILES[layer.marker],
        specPaths: layer.file ? [layer.file] : [],
      });
    }
  }

  const batches: InitBatch[] = [];
  if (!input.pagesOnly && foundationFiles.length > 0) {
    batches.push({
      kind: "foundation_data",
      marker: FOUNDATION_BATCH_MARKER,
      files: foundationFiles,
      specPaths: foundationSpecPaths,
    });
  }
  for (const page of pageBatches) batches.push(page);

  if (!input.pagesOnly) {
    batches.push({
      kind: "polish",
      marker: POLISH_BATCH_MARKER,
      files: [POLISH_PLACEHOLDER],
      specPaths: [],
    });
  }

  let totalFiles = 0;
  for (const batch of batches) totalFiles += batch.files.length;
  return { batches, totalFiles };
}

export type PlanValidationResult =
  | { ok: true }
  | { ok: false; reason: "batch_too_large" | "blocked_path"; offending?: string };

export function validatePlan(plan: InitBatchPlan): PlanValidationResult {
  for (const batch of plan.batches) {
    if (batch.files.length > INIT_BATCH_FILE_CAP) {
      return { ok: false, reason: "batch_too_large", offending: batch.marker };
    }
    for (const file of batch.files) {
      if (isBlockedProjectPath(file)) {
        return { ok: false, reason: "blocked_path", offending: file };
      }
    }
  }
  return { ok: true };
}

export type ReviseRequest = {
  batches: InitBatch[];
};

export function stripBlockedFromBatches(plan: InitBatchPlan): InitBatchPlan {
  const batches = plan.batches.map((batch) => ({
    ...batch,
    files: batch.files.filter((file) => !isBlockedProjectPath(file)),
  }));
  let totalFiles = 0;
  for (const batch of batches) totalFiles += batch.files.length;
  return { batches, totalFiles };
}
