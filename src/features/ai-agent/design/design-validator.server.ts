import {
  BlocksManifestSchema,
  type DesignManifest,
} from "@/features/ai-agent/design/blocks-manifest";
import {
  loadBlockLibrary,
  loadReferencePool,
  type LoaderOverrides,
} from "@/features/ai-agent/design/library-loader.server";

export type ValidationFailure =
  | { ok: false; reason: "structural"; details: string }
  | { ok: false; reason: "composition"; details: string }
  | { ok: false; reason: "affinity"; details: string }
  | { ok: false; reason: "cross-file"; details: string };

export type ValidationResult = { ok: true } | ValidationFailure;

const ANCHORS_LINE_REGEX = /\*\*Anchors:\*\*\s*([^\n]+)/;
const SECTION_1_HEADING = "## 1. Visual Theme & Atmosphere";

export async function validateManifestAndDesignSource(input: {
  manifest: unknown;
  designSource: string;
  loaderOverrides?: LoaderOverrides;
}): Promise<ValidationResult> {
  const parsed = BlocksManifestSchema.safeParse(input.manifest);
  if (!parsed.success) {
    return { ok: false, reason: "structural", details: parsed.error.message };
  }
  const manifest = parsed.data;

  const [library, pool] = await Promise.all([
    loadBlockLibrary(input.loaderOverrides),
    loadReferencePool(input.loaderOverrides),
  ]);

  const anchorIds = new Set(pool.anchors.map((a) => a.id));
  for (const anchor of manifest.vibe.anchors) {
    if (!anchorIds.has(anchor)) {
      return {
        ok: false,
        reason: "structural",
        details: `vibe anchor ${anchor} not in bounded list`,
      };
    }
  }

  const blocksById = new Map(library.blocks.map((b) => [b.blockId, b] as const));
  for (const entry of manifest.composition) {
    const block = blocksById.get(entry.blockId);
    if (!block) {
      return {
        ok: false,
        reason: "composition",
        details: `composition references unknown block ${entry.blockId}`,
      };
    }
    const variant = block.variants.find((v) => v.variantId === entry.variantId);
    if (!variant) {
      return {
        ok: false,
        reason: "composition",
        details: `block ${block.blockId} has no variant ${entry.variantId}`,
      };
    }
    const bestScore = Math.max(
      0,
      ...manifest.vibe.anchors.map((anchor) => variant.vibeAffinity[anchor] ?? 0),
    );
    if (bestScore < 0.35) {
      return {
        ok: false,
        reason: "affinity",
        details: `variant ${entry.variantId} of block ${block.blockId} has weak affinity (best ${bestScore.toFixed(2)}) with vibe ${manifest.vibe.anchors.join(",")}`,
      };
    }
  }

  // Composition rules
  const ordered = [...manifest.composition].sort((a, b) => a.position - b.position);
  const positions = new Map(ordered.map((e) => [e.blockId, e.position] as const));
  const present = new Set(ordered.map((e) => e.blockId));

  for (const block of library.blocks) {
    if (block.requirementLevel === "tier-1" && !present.has(block.blockId)) {
      return { ok: false, reason: "composition", details: `missing tier-1 block ${block.blockId}` };
    }
  }

  let socialProofCount = 0;
  for (const entry of ordered) {
    const block = blocksById.get(entry.blockId);
    if (!block) continue;
    if (block.requirementLevel === "group" && block.requirementGroup === "social-proof") {
      socialProofCount += 1;
    }
    for (const before of block.compositionRules.mustPrecede) {
      if (present.has(before) && (positions.get(entry.blockId) ?? 0) >= (positions.get(before) ?? 0)) {
        return { ok: false, reason: "composition", details: `${entry.blockId} must precede ${before}` };
      }
    }
    for (const after of block.compositionRules.mustFollow) {
      if (present.has(after) && (positions.get(entry.blockId) ?? 0) <= (positions.get(after) ?? 0)) {
        return { ok: false, reason: "composition", details: `${entry.blockId} must follow ${after}` };
      }
    }
    for (const exclusive of block.compositionRules.mutuallyExclusive) {
      if (present.has(exclusive)) {
        return { ok: false, reason: "composition", details: `${entry.blockId} mutually exclusive with ${exclusive}` };
      }
    }
  }
  if (socialProofCount === 0) {
    return { ok: false, reason: "composition", details: "no social-proof block present" };
  }

  for (const block of library.blocks) {
    if (block.requirementLevel === "tier-1" && typeof block.defaultPosition === "number") {
      const entry = ordered.find((e) => e.blockId === block.blockId);
      if (entry && entry.position !== block.defaultPosition) {
        return {
          ok: false,
          reason: "composition",
          details: `tier-1 block ${block.blockId} must occupy defaultPosition ${block.defaultPosition} (got ${entry.position})`,
        };
      }
    }
  }

  // Cross-file: anchors must match between DESIGN.md Section 1 and manifest
  const anchorMismatch = checkSection1Anchors(input.designSource, manifest);
  if (anchorMismatch) {
    return { ok: false, reason: "cross-file", details: anchorMismatch };
  }

  return { ok: true };
}

export function checkSection1Anchors(designSource: string, manifest: DesignManifest): string | null {
  if (!designSource.includes(SECTION_1_HEADING)) {
    return "DESIGN.md missing Section 1 heading";
  }
  const sectionStart = designSource.indexOf(SECTION_1_HEADING);
  const after = designSource.slice(sectionStart);
  const sectionEnd = after.search(/\n## 2\./);
  const section1 = sectionEnd === -1 ? after : after.slice(0, sectionEnd);
  const match = section1.match(ANCHORS_LINE_REGEX);
  if (!match) {
    return "Section 1 missing **Anchors:** bullet";
  }
  const parsed = match[1]
    .split(",")
    .map((s) => s.replace(/[*_`\s]+/g, "").trim())
    .filter(Boolean);
  const manifestAnchors = new Set(manifest.vibe.anchors);
  if (parsed.length !== manifestAnchors.size) {
    return `anchor count mismatch (DESIGN.md=${parsed.length}, manifest=${manifestAnchors.size})`;
  }
  for (const a of parsed) {
    if (!manifestAnchors.has(a)) {
      return `anchor ${a} present in DESIGN.md but not in manifest`;
    }
  }
  return null;
}
