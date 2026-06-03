import {
  loadBlockLibrary,
  type LoaderOverrides,
} from "@/features/ai-agent/design/library-loader.server";
import type {
  Block,
  BlockLibrary,
  CompositionEntry,
  Variant,
  Vibe,
} from "@/features/ai-agent/design/blocks-manifest";
import type { EnrichedSignal } from "@/features/ai-agent/planning/taxonomy-enrichment.server";
import { computeBlockSeed, pickIndexFromSeed } from "@/features/ai-agent/design/seed";
import {
  applyVerticalVariantFilter,
  isBlockForbiddenForVertical,
} from "@/features/ai-agent/design/vertical-layout-spec.server";
import type { VerticalLayoutSpec } from "@/features/ai-agent/design/vertical-layout-spec.schema";

export type RankerInput = {
  block: Block;
  project: {
    projectId: string;
    primaryCategory: string;
    subcategory: string | null;
    archetype: string | null;
    priceTier: string | null;
    vibe: Vibe;
  };
  alreadyComposedBlocks: Array<{ blockId: string; variantId: string; position: number }>;
};

export type RankerOutput = {
  ranked: Array<{ variantId: string; score: number; rationale: string }>;
};

export type VariantRankerFn = (input: RankerInput) => Promise<RankerOutput>;

export type ComposerOptions = {
  loaderOverrides?: LoaderOverrides;
};

const SOCIAL_PROOF_GROUP = "social-proof";

export class CompositionError extends Error {
  constructor(public reason: "composition" | "affinity", public details: string) {
    super(`${reason}-fail: ${details}`);
    this.name = "CompositionError";
  }
}

function isEligible(block: Block, signal: EnrichedSignal, vibe: Vibe): boolean {
  if (block.applicableCategories && !block.applicableCategories.includes(signal.primaryCategoryId)) {
    return false;
  }
  if (block.applicableVibes) {
    const overlaps = block.applicableVibes.some((v) => vibe.anchors.includes(v));
    if (!overlaps) return false;
  }
  return true;
}

/** Minimum affinity for a confident match; weaker scores use best-effort picking. */
const AFFINITY_MATCH_THRESHOLD = 0.5;
const AFFINITY_BEST_EFFORT_MIN = 0.35;

function variantHasAffinity(variant: Variant, vibe: Vibe): boolean {
  for (const anchor of vibe.anchors) {
    if ((variant.vibeAffinity[anchor] ?? 0) >= AFFINITY_MATCH_THRESHOLD) return true;
  }
  return false;
}

function blockHasUsableVariants(block: Block, vibe: Vibe): boolean {
  if (variantsHaveAnyAffinity(block, vibe)) return true;
  return block.variants.some((v) => bestAffinityScore(v, vibe) >= AFFINITY_BEST_EFFORT_MIN);
}

function pickBestEffortVariant(block: Block, vibe: Vibe): Variant {
  const sorted = [...block.variants].sort(
    (a, b) => bestAffinityScore(b, vibe) - bestAffinityScore(a, vibe),
  );
  const best = sorted[0];
  if (!best || bestAffinityScore(best, vibe) < AFFINITY_BEST_EFFORT_MIN) {
    throw new CompositionError(
      "affinity",
      `block ${block.blockId} has no variants with measurable affinity to vibe ${vibe.anchors.join(",")}`,
    );
  }
  return best;
}

function bestAffinityScore(variant: Variant, vibe: Vibe): number {
  let max = 0;
  for (const anchor of vibe.anchors) {
    const score = variant.vibeAffinity[anchor] ?? 0;
    if (score > max) max = score;
  }
  return max;
}

function chooseSupportingVariant(block: Block, vibe: Vibe, blockSeed: string): Variant {
  const eligible = block.variants.filter((v) => variantHasAffinity(v, vibe));
  const pool = eligible.length > 0 ? eligible : block.variants;
  if (pool.length === 0) {
    throw new CompositionError("affinity", `block ${block.blockId} has no variants`);
  }
  const idx = pickIndexFromSeed(blockSeed, pool.length);
  return pool[idx];
}

function fallbackRank(block: Block, vibe: Vibe): RankerOutput {
  const ordered = [...block.variants].sort((a, b) => bestAffinityScore(b, vibe) - bestAffinityScore(a, vibe));
  const top = ordered.slice(0, Math.min(3, ordered.length));
  return {
    ranked: top.map((v, i) => ({
      variantId: v.variantId,
      score: Math.max(0, bestAffinityScore(v, vibe) - i * 0.05),
      rationale: `Heuristic affinity match: best anchor score ${bestAffinityScore(v, vibe).toFixed(2)} on vibe ${vibe.anchors.join(",")}.`,
    })),
  };
}

async function rankAndPickHighImpact(
  block: Block,
  vibe: Vibe,
  signal: EnrichedSignal,
  composedSoFar: CompositionEntry[],
  ranker: VariantRankerFn | undefined,
  blockSeed: string,
  projectId: string,
): Promise<{ variant: Variant; rationale: string }> {
  if (!blockHasUsableVariants(block, vibe)) {
    throw new CompositionError(
      "affinity",
      `block ${block.blockId} variants have no usable affinity against vibe ${vibe.anchors.join(",")}`,
    );
  }
  if (!variantsHaveAnyAffinity(block, vibe)) {
    const best = pickBestEffortVariant(block, vibe);
    return {
      variant: best,
      rationale: `Best-effort affinity (${bestAffinityScore(best, vibe).toFixed(2)}) for vibe ${vibe.anchors.join(",")}.`,
    };
  }
  const baseInput: RankerInput = {
    block,
    project: {
      projectId,
      primaryCategory: signal.primaryCategoryId,
      subcategory: signal.subcategoryId,
      archetype: signal.archetype,
      priceTier: signal.priceTier,
      vibe,
    },
    alreadyComposedBlocks: composedSoFar.map((c) => ({
      blockId: c.blockId,
      variantId: c.variantId,
      position: c.position,
    })),
  };

  let output: RankerOutput | null = null;
  if (ranker) {
    try {
      const candidate = await ranker(baseInput);
      if (validateRankerOutput(block, candidate)) output = candidate;
    } catch {
      output = null;
    }
    if (!output) {
      try {
        const candidate = await ranker(baseInput);
        if (validateRankerOutput(block, candidate)) output = candidate;
      } catch {
        output = null;
      }
    }
  }
  if (!output) {
    output = fallbackRank(block, vibe);
  }
  if (output.ranked.length === 0) {
    throw new CompositionError("affinity", `block ${block.blockId} has no rankable variants`);
  }
  const idx = pickIndexFromSeed(blockSeed, output.ranked.length);
  const ordered = [output.ranked[idx], ...output.ranked.filter((_, i) => i !== idx)];
  for (const candidate of ordered) {
    const variant = block.variants.find((v) => v.variantId === candidate.variantId);
    if (!variant) continue;
    if (variantHasAffinity(variant, vibe)) {
      return { variant, rationale: candidate.rationale };
    }
  }
  // Fallback: pick the variant with highest affinity to vibe
  const fallback = [...block.variants]
    .filter((v) => variantHasAffinity(v, vibe))
    .sort((a, b) => bestAffinityScore(b, vibe) - bestAffinityScore(a, vibe))[0];
  if (!fallback) {
    throw new CompositionError("affinity", `block ${block.blockId} no variant matches vibe`);
  }
  return {
    variant: fallback,
    rationale: `Heuristic affinity match (best score ${bestAffinityScore(fallback, vibe).toFixed(2)}).`,
  };
}

function variantsHaveAnyAffinity(block: Block, vibe: Vibe): boolean {
  return block.variants.some((v) => variantHasAffinity(v, vibe));
}

function validateRankerOutput(block: Block, output: RankerOutput): boolean {
  if (!output || !Array.isArray(output.ranked) || output.ranked.length === 0) return false;
  if (output.ranked.length > 3) return false;
  const known = new Set(block.variants.map((v) => v.variantId));
  for (const r of output.ranked) {
    if (!known.has(r.variantId)) return false;
    if (typeof r.score !== "number" || r.score < 0 || r.score > 1) return false;
    if (typeof r.rationale !== "string" || r.rationale.length === 0) return false;
  }
  return true;
}

function checkCompositionRules(entries: CompositionEntry[], library: BlockLibrary): string | null {
  const blocksById = new Map(library.blocks.map((b) => [b.blockId, b] as const));
  const ordered = [...entries].sort((a, b) => a.position - b.position);
  const positions = new Map(ordered.map((e, i) => [e.blockId, i] as const));
  const present = new Set(ordered.map((e) => e.blockId));

  for (const block of library.blocks) {
    if (block.requirementLevel === "tier-1" && !present.has(block.blockId)) {
      return `missing tier-1 block ${block.blockId}`;
    }
  }

  for (const entry of ordered) {
    const block = blocksById.get(entry.blockId);
    if (!block) return `unknown block ${entry.blockId}`;
    for (const before of block.compositionRules.mustPrecede) {
      if (present.has(before)) {
        const beforeIdx = positions.get(entry.blockId)!;
        const afterIdx = positions.get(before)!;
        if (beforeIdx >= afterIdx) {
          return `${entry.blockId} must precede ${before}`;
        }
      }
    }
    for (const after of block.compositionRules.mustFollow) {
      if (present.has(after)) {
        const beforeIdx = positions.get(after)!;
        const afterIdx = positions.get(entry.blockId)!;
        if (afterIdx <= beforeIdx) {
          return `${entry.blockId} must follow ${after}`;
        }
      }
    }
    for (const exclusive of block.compositionRules.mutuallyExclusive) {
      if (present.has(exclusive)) {
        return `${entry.blockId} mutually exclusive with ${exclusive}`;
      }
    }
  }

  const groupCounts = new Map<string, number>();
  for (const entry of ordered) {
    const block = blocksById.get(entry.blockId);
    if (block?.requirementLevel === "group" && block.requirementGroup) {
      groupCounts.set(block.requirementGroup, (groupCounts.get(block.requirementGroup) ?? 0) + 1);
    }
  }
  if ((groupCounts.get(SOCIAL_PROOF_GROUP) ?? 0) === 0) {
    return `requirement group ${SOCIAL_PROOF_GROUP} not satisfied (need at least one)`;
  }
  return null;
}

function findOpenPosition(used: Set<number>, fallback: number): number {
  let pos = fallback;
  while (used.has(pos)) pos += 1;
  return pos;
}

function pickPositionForBlock(
  block: Block,
  entries: ReadonlyArray<CompositionEntry>,
  used: ReadonlySet<number>,
  library?: BlockLibrary,
): number | null {
  const present = new Map(entries.map((e) => [e.blockId, e.position] as const));
  let lowerExclusive = -1;
  for (const id of block.compositionRules.mustFollow) {
    const p = present.get(id);
    if (typeof p === "number" && p > lowerExclusive) lowerExclusive = p;
  }
  let upperExclusive = Number.POSITIVE_INFINITY;
  for (const id of block.compositionRules.mustPrecede) {
    const p = present.get(id);
    if (typeof p === "number" && p < upperExclusive) upperExclusive = p;
  }
  if (library) {
    for (const other of library.blocks) {
      const otherPos = present.get(other.blockId);
      if (typeof otherPos !== "number") continue;
      if (other.compositionRules.mustPrecede.includes(block.blockId) && otherPos > lowerExclusive) {
        lowerExclusive = otherPos;
      }
      if (other.compositionRules.mustFollow.includes(block.blockId) && otherPos < upperExclusive) {
        upperExclusive = otherPos;
      }
    }
  }
  for (let pos = lowerExclusive + 1; pos < upperExclusive; pos++) {
    if (!used.has(pos)) return pos;
  }
  return null;
}

function resolveBlockForVertical(block: Block, vertical?: VerticalLayoutSpec): Block | null {
  if (!vertical) return block;
  return applyVerticalVariantFilter(block, vertical);
}

export async function composeDesign(input: {
  projectId: string;
  signal: EnrichedSignal;
  vibe: Vibe;
  seed: string;
  ranker?: VariantRankerFn;
  verticalLayout?: VerticalLayoutSpec;
  options?: ComposerOptions;
}): Promise<{ composition: CompositionEntry[]; library: BlockLibrary }> {
  const vertical = input.verticalLayout;
  const library = await loadBlockLibrary(input.options?.loaderOverrides);
  const blocksById = new Map(library.blocks.map((b) => [b.blockId, b] as const));

  const tier1 = library.blocks.filter((b) => b.requirementLevel === "tier-1");
  const groupBlocks = library.blocks.filter((b) => b.requirementLevel === "group" && b.requirementGroup);
  const optionalBlocks = library.blocks.filter((b) => b.requirementLevel === "optional");

  const entries: CompositionEntry[] = [];
  const usedPositions = new Set<number>();

  // Tier 1: always include at fixed defaultPosition.
  const tier1Ordered = [...tier1].sort((a, b) => (a.defaultPosition ?? 0) - (b.defaultPosition ?? 0));
  for (const block of tier1Ordered) {
    const resolved = resolveBlockForVertical(block, vertical);
    if (!resolved) {
      if (vertical && isBlockForbiddenForVertical(block.blockId, vertical)) {
        continue;
      }
      throw new CompositionError(
        "composition",
        `tier-1 block ${block.blockId} has no variants allowed for vertical ${vertical?.templateId ?? "none"}`,
      );
    }
    const blockSeed = computeBlockSeed(input.seed, resolved.blockId);
    let variantId: string;
    let rationale: string | null;
    if (resolved.tier === "high-impact") {
      const picked = await rankAndPickHighImpact(resolved, input.vibe, input.signal, entries, input.ranker, blockSeed, input.projectId);
      variantId = picked.variant.variantId;
      rationale = picked.rationale;
    } else {
      variantId = chooseSupportingVariant(resolved, input.vibe, blockSeed).variantId;
      rationale = null;
    }
    const position = resolved.defaultPosition!;
    usedPositions.add(position);
    entries.push({
      blockId: resolved.blockId,
      variantId,
      tier: resolved.tier,
      position,
      rankRationale: rationale,
    });
  }

  // Group: pick one social-proof block deterministically.
  let socialPool = groupBlocks
    .filter((b) => b.requirementGroup === SOCIAL_PROOF_GROUP && isEligible(b, input.signal, input.vibe))
    .filter((b) => !vertical || !isBlockForbiddenForVertical(b.blockId, vertical))
    .filter((b) => blockHasUsableVariants(b, input.vibe))
    .sort((a, b) => a.blockId.localeCompare(b.blockId));
  if (vertical?.homepage.preferredSocialProofBlocks?.length) {
    const preferred = socialPool.filter((b) =>
      vertical.homepage.preferredSocialProofBlocks!.includes(b.blockId),
    );
    if (preferred.length > 0) socialPool = preferred;
  }
  if (socialPool.length === 0) {
    const fallback = groupBlocks
      .filter((b) => b.requirementGroup === SOCIAL_PROOF_GROUP)
      .sort((a, b) => a.blockId.localeCompare(b.blockId));
    if (fallback.length === 0) {
      throw new CompositionError("composition", "no social-proof block available in library");
    }
    socialPool.push(...fallback);
  }
  const groupSeed = computeBlockSeed(input.seed, "social-proof-group");
  const chosenGroupBlockRaw = socialPool[pickIndexFromSeed(groupSeed, socialPool.length)];
  const chosenGroupBlock =
    resolveBlockForVertical(chosenGroupBlockRaw, vertical) ?? chosenGroupBlockRaw;
  const groupVariant = chooseSupportingVariant(
    chosenGroupBlock,
    input.vibe,
    computeBlockSeed(input.seed, chosenGroupBlock.blockId),
  );
  const groupPosition = pickPositionForBlock(chosenGroupBlock, entries, usedPositions, library) ?? findOpenPosition(usedPositions, 5);
  usedPositions.add(groupPosition);
  entries.push({
    blockId: chosenGroupBlock.blockId,
    variantId: groupVariant.variantId,
    tier: chosenGroupBlock.tier,
    position: groupPosition,
    rankRationale: null,
  });

  // Optional: include category-specific high-impact + supporting blocks.
  const requiredOptional = new Set(vertical?.homepage.requiredOptionalSlots ?? []);
  const preferredOptional = new Set(vertical?.homepage.preferredOptionalSlots ?? []);

  const optionalEligible = optionalBlocks
    .filter((b) => isEligible(b, input.signal, input.vibe))
    .filter((b) => !vertical || !isBlockForbiddenForVertical(b.blockId, vertical))
    .filter((b) => blockHasUsableVariants(b, input.vibe))
    .map((b) => resolveBlockForVertical(b, vertical))
    .filter((b): b is Block => b !== null);

  const optionalSeed = computeBlockSeed(input.seed, "optional-pool");
  const optionalIncludeMask = optionalEligible.map((block, i) => {
    if (requiredOptional.has(block.blockId) || preferredOptional.has(block.blockId)) {
      return true;
    }
    const childSeed = computeBlockSeed(optionalSeed, `slot-${i}`);
    return parseInt(childSeed.slice(0, 8), 16) % 2 === 0;
  });

  for (let i = 0; i < optionalEligible.length; i++) {
    if (!optionalIncludeMask[i]) continue;
    const block = optionalEligible[i];
    const blockSeed = computeBlockSeed(input.seed, block.blockId);
    let variantId: string;
    let rationale: string | null;
    if (block.tier === "high-impact") {
      const picked = await rankAndPickHighImpact(block, input.vibe, input.signal, entries, input.ranker, blockSeed, input.projectId);
      variantId = picked.variant.variantId;
      rationale = picked.rationale;
    } else {
      variantId = chooseSupportingVariant(block, input.vibe, blockSeed).variantId;
      rationale = null;
    }
    const position = pickPositionForBlock(block, entries, usedPositions, library);
    if (position === null) continue;
    usedPositions.add(position);
    entries.push({
      blockId: block.blockId,
      variantId,
      tier: block.tier,
      position,
      rankRationale: rationale,
    });
  }

  entries.sort((a, b) => a.position - b.position);

  const violation = checkCompositionRules(entries, library);
  if (violation) {
    throw new CompositionError("composition", violation);
  }
  void blocksById;

  return { composition: entries, library };
}

export function blockLibraryFor(): never {
  throw new Error("use loadBlockLibrary");
}
