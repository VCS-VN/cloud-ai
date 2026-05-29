import { promises as fs } from "node:fs";
import path from "node:path";
import {
  BlocksManifestSchema,
  type DesignManifest,
  type Vibe,
} from "@/features/ai-agent/design/blocks-manifest";
import { atomicWriteFile } from "@/features/ai-agent/design/atomic-write";
import { computeSeed } from "@/features/ai-agent/design/seed";
import {
  loadBlockLibrary,
  loadReferencePool,
  type LoaderOverrides,
} from "@/features/ai-agent/design/library-loader.server";
import { authorVibe, type VibeAuthorFn } from "@/features/ai-agent/design/vibe-author.server";
import type { EnrichedSignal } from "@/features/ai-agent/planning/taxonomy-enrichment.server";

const SECTION_1_HEADING = "## 1. Visual Theme & Atmosphere";

export type LazyMigrationOptions = {
  loaderOverrides?: LoaderOverrides;
  authorFn?: VibeAuthorFn;
};

export type LazyMigrationResult =
  | { status: "skipped"; reason: "manifest-exists" | "no-design-md" }
  | { status: "migrated"; manifest: DesignManifest };

const VIBE_LABEL_REGEX = /\b(minimalist|minimal|editorial|retro|vintage|playful|luxury|premium|organic|natural|streetwear|tech|cyber|premium|friendly|approachable|bold|maximalist|handcrafted|artisan|refined|classic|warm|approachable)\b/i;

export async function lazyMigrateIfNeeded(
  workspacePath: string,
  projectId: string,
  signal: EnrichedSignal | null,
  options: LazyMigrationOptions = {},
): Promise<LazyMigrationResult> {
  const manifestPath = path.join(workspacePath, "blocks.json");
  const designPath = path.join(workspacePath, "DESIGN.md");

  if (await fileExists(manifestPath)) {
    return { status: "skipped", reason: "manifest-exists" };
  }
  if (!(await fileExists(designPath))) {
    return { status: "skipped", reason: "no-design-md" };
  }

  const designSource = await fs.readFile(designPath, "utf8");
  const legacyLabel = extractLegacyVibeLabel(designSource);

  const pool = await loadReferencePool(options.loaderOverrides);
  const library = await loadBlockLibrary(options.loaderOverrides);

  const anchor = mapLegacyLabelToAnchor(legacyLabel, pool);
  const fallbackVibeValue: Vibe = {
    descriptor: legacyLabel
      ? `${legacyLabel} sensibility, refined`
      : `${anchor} sensibility, refined`,
    anchors: [anchor],
    story: `Migrated from legacy design rule set; tone preserved as ${anchor}.`,
  };

  let vibe: Vibe = fallbackVibeValue;
  if (signal) {
    try {
      const result = await authorVibe(signal, options.authorFn, {
        loaderOverrides: options.loaderOverrides,
      });
      vibe = result.usedFallback ? fallbackVibeValue : { ...result.vibe, anchors: [anchor] };
    } catch {
      vibe = fallbackVibeValue;
    }
  }

  // Default rhythm: tier-1 at defaultPosition, plus 1 social-proof block (variant index 0).
  const composition = library.blocks
    .filter((b) => b.requirementLevel === "tier-1")
    .sort((a, b) => (a.defaultPosition ?? 0) - (b.defaultPosition ?? 0))
    .map((b) => ({
      blockId: b.blockId,
      variantId: b.variants[0].variantId,
      tier: b.tier,
      position: b.defaultPosition!,
      rankRationale: b.tier === "high-impact" ? "Migrated default — first variant of legacy block." : null,
    }));

  const socialProof = library.blocks
    .filter((b) => b.requirementLevel === "group" && b.requirementGroup === "social-proof")
    .sort((a, b) => a.blockId.localeCompare(b.blockId))[0];
  if (socialProof) {
    composition.push({
      blockId: socialProof.blockId,
      variantId: socialProof.variants[0].variantId,
      tier: socialProof.tier,
      position: 5,
      rankRationale: null,
    });
  }
  composition.sort((a, b) => a.position - b.position);

  const manifest: DesignManifest = BlocksManifestSchema.parse({
    manifestVersion: 1,
    designVersion: 1,
    shakeRevision: 0,
    seed: computeSeed(projectId, 1, 0),
    vibe,
    composition,
    generatedAt: new Date().toISOString(),
    lastIntent: "init",
  });

  const rewrittenSection1 = renderSection1(vibe);
  const updatedSource = replaceSection1(designSource, rewrittenSection1);

  await atomicWriteFile(manifestPath, JSON.stringify(manifest, null, 2));
  await atomicWriteFile(designPath, updatedSource);

  return { status: "migrated", manifest };
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

function extractLegacyVibeLabel(source: string): string | null {
  const sectionStart = source.indexOf(SECTION_1_HEADING);
  if (sectionStart === -1) return null;
  const after = source.slice(sectionStart);
  const sectionEnd = after.search(/\n## 2\./);
  const section1 = sectionEnd === -1 ? after : after.slice(0, sectionEnd);
  const match = section1.match(VIBE_LABEL_REGEX);
  return match ? match[1].toLowerCase() : null;
}

function mapLegacyLabelToAnchor(
  label: string | null,
  pool: Awaited<ReturnType<typeof loadReferencePool>>,
): string {
  if (label) {
    for (const anchor of pool.anchors) {
      if (anchor.legacyLabels.some((l) => l.toLowerCase() === label)) {
        return anchor.id;
      }
      if (anchor.id === label) return anchor.id;
    }
  }
  return pool.anchors[0]?.id ?? "minimalist";
}

function renderSection1(vibe: Vibe): string {
  return [
    SECTION_1_HEADING,
    "",
    `- **Descriptor:** ${vibe.descriptor}`,
    `- **Anchors:** ${vibe.anchors.join(", ")}`,
    `- **Story:** ${vibe.story}`,
    "",
  ].join("\n");
}

function replaceSection1(source: string, replacement: string): string {
  const start = source.indexOf(SECTION_1_HEADING);
  if (start === -1) {
    return `${replacement}\n${source}`;
  }
  const after = source.slice(start);
  const nextHeadingIdx = after.search(/\n## 2\./);
  if (nextHeadingIdx === -1) {
    return `${source.slice(0, start)}${replacement}`;
  }
  return `${source.slice(0, start)}${replacement}${after.slice(nextHeadingIdx)}`;
}
