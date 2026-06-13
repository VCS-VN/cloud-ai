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

type ManifestEntry = {
  marker: string;
  order: number;
  file?: string;
  type?: "dynamic";
};

// Ordered phases the AGENT must author. Each entry becomes ONE batch, emitted
// in array order. Required commerce routes are seeded before this loop.
//
// Everything that is fixed plumbing — data entities (src/data/*), lib helpers
// (format-money), the 5 store hooks (src/services/store/*), the 3 providers
// (src/app/*-provider), apiClient, website-config, cart-selection, providers
// wrapper — is now SEEDED as a runtime-owned file before the agent loop (see
// init-settings-seed.server.ts). The model (esp. cloud-ai) could not be trusted
// to emit these turn-by-turn: it narrated intent and ran zero commands, dead-
// ending batches; and when it did write them the contracts were wrong (react-
// query v5 onSuccess, lodash not in deps, wrong cart shape). Seeding removes
// those batches entirely. The agent now only authors what genuinely needs the
// brief: DESIGN.md (visual identity), storefront components, and final polish.
type InitPhase = {
  marker: string;
  files: string[];
  // Manifest-relative spec bodies describing HOW to author the files in scope.
  specPaths?: string[];
};

const INIT_PHASES: readonly InitPhase[] = [
  {
    marker: "DESIGN_DOC",
    files: ["DESIGN.md"],
    // DESIGN.md authoring rules live inline in system.md; no separate spec body.
  },
  {
    marker: "COMPONENTS",
    files: [
      "src/components/layout/site-header.tsx",
      "src/components/layout/site-footer.tsx",
      "src/components/store/product-card.tsx",
      "src/components/store/product-grid.tsx",
      "src/components/store/cart-item.tsx",
      "src/components/store/order-card.tsx",
      "src/components/store/not-found.tsx",
      // The homepage is the only route the agent authors. All other commerce
      // routes are seeded runtime-owned and reverted if touched; home carries
      // the storefront's visual identity, so it ships in this batch alongside
      // the components that compose it.
      "src/routes/index.tsx",
    ],
    specPaths: ["data/component.md", "pages/home.md"],
  },
];

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

  void layers;

  const batches: InitBatch[] = [];
  // Init is now a small sequence of dependency-ordered phases, each emitted as
  // its own batch so the model finishes each instead of dead-ending on one large
  // batch. Fixed plumbing and required commerce routes are seeded first. The
  // agent only authors DESIGN.md + the storefront components; the polish batch
  // was dropped — it targeted a never-written placeholder and added a turn
  // without producing files.
  if (!input.pagesOnly) {
    for (const phase of INIT_PHASES) {
      batches.push({
        kind: "foundation_data",
        marker: phase.marker,
        files: [...phase.files],
        specPaths: phase.specPaths ? [...phase.specPaths] : [],
      });
    }
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
