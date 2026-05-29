import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  BlocksManifestSchema,
  type DesignManifest,
  type DesignIntent,
  type Vibe,
  type CompositionEntry,
} from "@/features/ai-agent/design/blocks-manifest";
import { atomicWriteFile } from "@/features/ai-agent/design/atomic-write";
import { computeSeed } from "@/features/ai-agent/design/seed";
import {
  authorVibe,
  type VibeAuthorFn,
} from "@/features/ai-agent/design/vibe-author.server";
import {
  composeDesign,
  CompositionError,
  type VariantRankerFn,
} from "@/features/ai-agent/design/block-composer.server";
import { validateManifestAndDesignSource } from "@/features/ai-agent/design/design-validator.server";
import {
  emitDesignGenerated,
  type DesignGeneratedEvent,
} from "@/features/ai-agent/design/telemetry";
import {
  enrichTaxonomy,
  type EnrichedSignal,
} from "@/features/ai-agent/planning/taxonomy-enrichment.server";
import { lazyMigrateIfNeeded } from "@/features/ai-agent/design/lazy-migration.server";

export type DesignPipelineInput = {
  projectId: string;
  intent: DesignIntent;
  workspacePath: string;
  signal: {
    primaryCategoryId: string;
    subcategoryId: string | null;
    archetype: string | null;
    priceTier: "value" | "mainstream" | "premium" | "luxury" | null;
    promptText: string;
    websiteSpec: { name?: string; products?: string[] };
  };
  tokenPatch?: ReadonlyArray<{ section: number; tokenName: string; nextValue: string }>;
};

export type DesignPipelineDeps = {
  authorVibe?: VibeAuthorFn;
  rankVariants?: VariantRankerFn;
  emitTelemetry?: (event: DesignGeneratedEvent) => Promise<void>;
  now?: () => string;
  loaderOverrides?: Parameters<typeof enrichTaxonomy>[1];
};

export type DesignPipelineResult =
  | { status: "ok"; manifest: DesignManifest; designSourceHash: string }
  | { status: "needs-manual-review"; reason: string; details: string }
  | { status: "no-op" };

const DEFAULT_NOW = () => new Date().toISOString();

export async function runDesignPipeline(
  input: DesignPipelineInput,
  deps: DesignPipelineDeps = {},
): Promise<DesignPipelineResult> {
  if (input.intent === "update_no_design") {
    return { status: "no-op" };
  }
  if (input.intent !== "init") {
    try {
      let enrichedForMigration: EnrichedSignal | null = null;
      try {
        enrichedForMigration = await enrichTaxonomy(
          {
            primaryCategoryId: input.signal.primaryCategoryId,
            subcategoryId: input.signal.subcategoryId,
            archetype: input.signal.archetype,
            priceTier: input.signal.priceTier,
            promptText: input.signal.promptText,
            websiteSpec: input.signal.websiteSpec,
          },
          deps.loaderOverrides,
        );
      } catch {
        enrichedForMigration = null;
      }
      await lazyMigrateIfNeeded(input.workspacePath, input.projectId, enrichedForMigration, {
        loaderOverrides: deps.loaderOverrides,
        authorFn: deps.authorVibe,
      });
    } catch {
      // Migration best-effort; fall through to intent handler which surfaces manifest-corrupt if needed.
    }
  }
  if (input.intent === "init") {
    return runInit(input, deps);
  }
  if (input.intent === "redesign") {
    return runRedesign(input, deps);
  }
  if (input.intent === "shake_design") {
    return runShake(input, deps);
  }
  if (input.intent === "update_token") {
    return runUpdateToken(input, deps);
  }
  return {
    status: "needs-manual-review",
    reason: "unknown-intent",
    details: `intent ${String(input.intent)} not supported`,
  };
}

async function runInit(input: DesignPipelineInput, deps: DesignPipelineDeps): Promise<DesignPipelineResult> {
  return runFullGeneration(input, deps, { designVersion: 1, shakeRevision: 0, intent: "init" });
}

async function runRedesign(input: DesignPipelineInput, deps: DesignPipelineDeps): Promise<DesignPipelineResult> {
  const existing = await readManifestSafe(input.workspacePath);
  const nextVersion = existing ? existing.designVersion + 1 : 1;
  return runFullGeneration(input, deps, {
    designVersion: nextVersion,
    shakeRevision: 0,
    intent: "redesign",
  });
}

async function runShake(input: DesignPipelineInput, deps: DesignPipelineDeps): Promise<DesignPipelineResult> {
  const existing = await readManifestSafe(input.workspacePath);
  if (!existing) {
    return {
      status: "needs-manual-review",
      reason: "manifest-corrupt",
      details: "shake_design requires an existing manifest",
    };
  }
  return runFullGeneration(
    input,
    deps,
    {
      designVersion: existing.designVersion,
      shakeRevision: existing.shakeRevision + 1,
      intent: "shake_design",
      preservedVibe: existing.vibe,
      preservedComposition: existing.composition,
    },
  );
}

async function runUpdateToken(input: DesignPipelineInput, deps: DesignPipelineDeps): Promise<DesignPipelineResult> {
  const existing = await readManifestSafe(input.workspacePath);
  if (!existing) {
    return {
      status: "needs-manual-review",
      reason: "manifest-corrupt",
      details: "update_token requires an existing manifest",
    };
  }
  const designPath = path.join(input.workspacePath, "DESIGN.md");
  let designSource: string;
  try {
    designSource = await fs.readFile(designPath, "utf8");
  } catch {
    return {
      status: "needs-manual-review",
      reason: "manifest-corrupt",
      details: "DESIGN.md missing for update_token",
    };
  }
  const patched = applyTokenPatchSimple(designSource, input.tokenPatch ?? []);
  const generatedAt = (deps.now ?? DEFAULT_NOW)();
  const manifest: DesignManifest = {
    ...existing,
    generatedAt,
    lastIntent: "update_token",
  };
  await atomicWriteFile(path.join(input.workspacePath, "blocks.json"), JSON.stringify(manifest, null, 2));
  await atomicWriteFile(designPath, patched);
  return { status: "ok", manifest, designSourceHash: hashContent(patched) };
}

type GenerationConfig = {
  designVersion: number;
  shakeRevision: number;
  intent: Exclude<DesignIntent, "update_token" | "update_no_design">;
  preservedVibe?: Vibe;
  preservedComposition?: CompositionEntry[];
};

async function runFullGeneration(
  input: DesignPipelineInput,
  deps: DesignPipelineDeps,
  cfg: GenerationConfig,
): Promise<DesignPipelineResult> {
  let enriched: EnrichedSignal;
  try {
    enriched = await enrichTaxonomy(
      {
        primaryCategoryId: input.signal.primaryCategoryId,
        subcategoryId: input.signal.subcategoryId,
        archetype: input.signal.archetype,
        priceTier: input.signal.priceTier,
        promptText: input.signal.promptText,
        websiteSpec: input.signal.websiteSpec,
      },
      deps.loaderOverrides,
    );
  } catch (error) {
    return {
      status: "needs-manual-review",
      reason: "taxonomy",
      details: error instanceof Error ? error.message : String(error),
    };
  }

  const seed = computeSeed(input.projectId, cfg.designVersion, cfg.shakeRevision);

  let vibe: Vibe;
  if (cfg.preservedVibe) {
    vibe = cfg.preservedVibe;
  } else {
    try {
      const result = await authorVibe(enriched, deps.authorVibe, {
        loaderOverrides: deps.loaderOverrides,
      });
      vibe = result.vibe;
    } catch (error) {
      return {
        status: "needs-manual-review",
        reason: "vibe",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  let composition: CompositionEntry[];
  try {
    if (cfg.preservedComposition) {
      composition = await reshakeComposition(cfg.preservedComposition, vibe, seed, enriched, input.projectId, deps.rankVariants);
    } else {
      const result = await composeDesign({
        projectId: input.projectId,
        signal: enriched,
        vibe,
        seed,
        ranker: deps.rankVariants,
        options: { loaderOverrides: deps.loaderOverrides },
      });
      composition = result.composition;
    }
  } catch (error) {
    if (error instanceof CompositionError) {
      return {
        status: "needs-manual-review",
        reason: error.reason,
        details: error.details,
      };
    }
    return {
      status: "needs-manual-review",
      reason: "composition",
      details: error instanceof Error ? error.message : String(error),
    };
  }

  const generatedAt = (deps.now ?? DEFAULT_NOW)();

  const manifestCandidate: DesignManifest = {
    manifestVersion: 1,
    designVersion: cfg.designVersion,
    shakeRevision: cfg.shakeRevision,
    seed,
    vibe,
    composition: [...composition].sort((a, b) => a.position - b.position),
    generatedAt,
    lastIntent: cfg.intent,
  };

  const designSource = renderDesignMarkdown(manifestCandidate);

  const validation = await validateManifestAndDesignSource({
    manifest: manifestCandidate,
    designSource,
    loaderOverrides: deps.loaderOverrides,
  });
  if (!validation.ok) {
    return {
      status: "needs-manual-review",
      reason: validation.reason,
      details: validation.details,
    };
  }

  const manifest = BlocksManifestSchema.parse(manifestCandidate);
  await atomicWriteFile(
    path.join(input.workspacePath, "blocks.json"),
    JSON.stringify(manifest, null, 2),
  );
  await atomicWriteFile(path.join(input.workspacePath, "DESIGN.md"), designSource);

  await emitTelemetrySafely(deps, {
    type: "design_generated",
    schemaVersion: 1,
    projectId: input.projectId,
    intent: cfg.intent,
    vibe: { descriptor: vibe.descriptor, anchors: vibe.anchors },
    category: { primary: enriched.primaryCategoryId, subcategory: enriched.subcategoryId },
    variantChoices: composition.map((c) => ({ blockId: c.blockId, variantId: c.variantId, tier: c.tier })),
    designVersion: cfg.designVersion,
    shakeRevision: cfg.shakeRevision,
    generatedAt,
  });

  return { status: "ok", manifest, designSourceHash: hashContent(designSource) };
}

async function reshakeComposition(
  preserved: CompositionEntry[],
  vibe: Vibe,
  seed: string,
  enriched: EnrichedSignal,
  projectId: string,
  ranker: VariantRankerFn | undefined,
): Promise<CompositionEntry[]> {
  const result = await composeDesign({
    projectId,
    signal: enriched,
    vibe,
    seed,
    ranker,
  });
  // Restrict to the preserved blockId/position set; choose new variants from composer's output
  const composedById = new Map(result.composition.map((c) => [c.blockId, c] as const));
  const next: CompositionEntry[] = preserved.map((entry) => {
    const fresh = composedById.get(entry.blockId);
    if (!fresh) return entry;
    return {
      blockId: entry.blockId,
      variantId: fresh.variantId,
      tier: entry.tier,
      position: entry.position,
      rankRationale: entry.tier === "high-impact" ? fresh.rankRationale : null,
    };
  });
  return next;
}

async function readManifestSafe(workspacePath: string): Promise<DesignManifest | null> {
  const manifestPath = path.join(workspacePath, "blocks.json");
  try {
    const text = await fs.readFile(manifestPath, "utf8");
    const parsed = JSON.parse(text);
    return BlocksManifestSchema.parse(parsed);
  } catch {
    return null;
  }
}

function renderDesignMarkdown(manifest: DesignManifest): string {
  const anchors = manifest.vibe.anchors.join(", ");
  return [
    `## 1. Visual Theme & Atmosphere`,
    ``,
    `- **Descriptor:** ${manifest.vibe.descriptor}`,
    `- **Anchors:** ${anchors}`,
    `- **Story:** ${manifest.vibe.story}`,
    ``,
    `## 2. Color Palette & Roles`,
    ``,
    `_Tokens populated by downstream design-rule pipeline._`,
    ``,
    `## 3. Typography Rules`,
    ``,
    `_Tokens populated by downstream design-rule pipeline._`,
    ``,
    `## 4. Spacing System`,
    ``,
    `_Tokens populated by downstream design-rule pipeline._`,
    ``,
    `## 5. Radius, Shadow & Motion`,
    ``,
    `_Tokens populated by downstream design-rule pipeline._`,
    ``,
    `## 6. Component Styling`,
    ``,
    renderComposition(manifest.composition),
    ``,
    `## 7. Layout Principles`,
    ``,
    `_Tokens populated by downstream design-rule pipeline._`,
    ``,
    `## 8. Responsive Behavior`,
    ``,
    `_Tokens populated by downstream design-rule pipeline._`,
    ``,
  ].join("\n");
}

function renderComposition(entries: ReadonlyArray<CompositionEntry>): string {
  const ordered = [...entries].sort((a, b) => a.position - b.position);
  return ordered
    .map((e) => `- **${e.blockId}** (${e.tier}) → variant \`${e.variantId}\``)
    .join("\n");
}

function applyTokenPatchSimple(source: string, patches: ReadonlyArray<{ section: number; tokenName: string; nextValue: string }>): string {
  // Minimal placeholder: append a note section if patches provided, leaving structure intact.
  if (patches.length === 0) return source;
  const note = patches
    .map((p) => `- Section ${p.section} ${p.tokenName} → ${p.nextValue}`)
    .join("\n");
  return `${source.trimEnd()}\n\n<!-- token patches applied:\n${note}\n-->\n`;
}

function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

async function emitTelemetrySafely(
  deps: DesignPipelineDeps,
  event: DesignGeneratedEvent,
): Promise<void> {
  try {
    if (deps.emitTelemetry) {
      await deps.emitTelemetry(event);
    } else {
      await emitDesignGenerated(event);
    }
  } catch {
    /* swallow — telemetry failures must never block pipeline */
  }
}
