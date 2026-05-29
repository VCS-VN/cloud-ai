import { z } from "zod";

const SLUG_REGEX = /^[a-z][a-z0-9-]*$/;
const SLUG_PATTERN = z
  .string()
  .min(1)
  .regex(SLUG_REGEX, { message: "must be kebab-case (lowercase letters, digits, dashes)" });

const SCORE_RANGE = z.number().min(0).max(1);

const COMMERCE_GOAL = z.enum(["discovery", "conversion", "trust", "retention"]);
const REQUIREMENT_LEVEL = z.enum(["tier-1", "group", "optional"]);
const TIER = z.enum(["high-impact", "supporting"]);
const INTENT = z.enum(["init", "update_token", "update_no_design", "redesign", "shake_design"]);

// ---------- Block Library (T005) ----------

const VariantSchema = z.object({
  variantId: SLUG_PATTERN,
  shape: z.string().min(1),
  vibeAffinity: z.record(z.string(), SCORE_RANGE).refine((rec) => Object.keys(rec).length > 0, {
    message: "vibeAffinity must declare at least one anchor",
  }),
  notes: z.string().nullable().optional().default(null),
});

const CompositionRulesSchema = z.object({
  mustPrecede: z.array(SLUG_PATTERN).default([]),
  mustFollow: z.array(SLUG_PATTERN).default([]),
  mutuallyExclusive: z.array(SLUG_PATTERN).default([]),
  maxOccurrences: z.number().int().min(1),
});

const BlockSchema = z
  .object({
    blockId: SLUG_PATTERN,
    tier: TIER,
    requirementLevel: REQUIREMENT_LEVEL,
    requirementGroup: z.string().nullable().optional().default(null),
    defaultPosition: z.number().int().min(0).nullable().optional().default(null),
    applicableCategories: z.array(z.string()).nullable().optional().default(null),
    applicableSubcategories: z.array(z.string()).nullable().optional().default(null),
    applicableVibes: z.array(z.string()).nullable().optional().default(null),
    commerceGoal: COMMERCE_GOAL,
    compositionRules: CompositionRulesSchema,
    variants: z.array(VariantSchema).min(1),
  })
  .superRefine((block, ctx) => {
    if (block.requirementLevel === "tier-1" && block.defaultPosition === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "tier-1 blocks must declare defaultPosition",
        path: ["defaultPosition"],
      });
    }
    if (block.requirementLevel === "group" && !block.requirementGroup) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "requirementLevel=group requires requirementGroup",
        path: ["requirementGroup"],
      });
    }
    const self = block.blockId;
    const ruleArrays: Array<keyof z.infer<typeof CompositionRulesSchema>> = [
      "mustPrecede",
      "mustFollow",
      "mutuallyExclusive",
    ];
    for (const key of ruleArrays) {
      const arr = block.compositionRules[key];
      if (Array.isArray(arr) && arr.includes(self)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `compositionRules.${key} must not reference self`,
          path: ["compositionRules", key],
        });
      }
    }
    for (const variant of block.variants) {
      const hasStrong = Object.values(variant.vibeAffinity).some((score) => score >= 0.5);
      if (!hasStrong) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `variant ${variant.variantId} must have at least one anchor with affinity >= 0.5`,
          path: ["variants"],
        });
      }
    }
  });

export const BlockLibrarySchema = z
  .object({
    version: z.literal(1),
    blocks: z.array(BlockSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const ids = new Set<string>();
    for (const block of data.blocks) {
      if (ids.has(block.blockId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate blockId: ${block.blockId}`,
          path: ["blocks"],
        });
      }
      ids.add(block.blockId);
    }
  });

export type Block = z.infer<typeof BlockSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type BlockLibrary = z.infer<typeof BlockLibrarySchema>;

// ---------- Category Taxonomy (T006) ----------

const SubcategorySchema = z.object({
  id: SLUG_PATTERN,
  label: z.string().min(1),
});

const PrimaryCategorySchema = z
  .object({
    id: SLUG_PATTERN,
    label: z.string().min(1),
    description: z.string().nullable().optional().default(null),
    subcategories: z.array(SubcategorySchema).min(1).max(12),
  })
  .superRefine((primary, ctx) => {
    const seen = new Set<string>();
    for (const sub of primary.subcategories) {
      if (seen.has(sub.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate subcategory id "${sub.id}" in primary "${primary.id}"`,
          path: ["subcategories"],
        });
      }
      seen.add(sub.id);
    }
  });

export const CategoryTaxonomySchema = z
  .object({
    version: z.literal(1),
    primary: z.array(PrimaryCategorySchema).min(5).max(30),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (const primary of data.primary) {
      if (seen.has(primary.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate primary id: ${primary.id}`,
          path: ["primary"],
        });
      }
      seen.add(primary.id);
    }
  });

export type PrimaryCategory = z.infer<typeof PrimaryCategorySchema>;
export type Subcategory = z.infer<typeof SubcategorySchema>;
export type CategoryTaxonomy = z.infer<typeof CategoryTaxonomySchema>;

// ---------- Vibe Reference Pool (T007) ----------

const AnchorSchema = z.object({
  id: SLUG_PATTERN,
  description: z.string().min(30).max(200),
  legacyLabels: z.array(z.string().min(1)).default([]),
});

const ReferencePoolEntrySchema = z.object({
  id: z.string().min(1),
  anchors: z.array(SLUG_PATTERN).min(1).max(2),
  applicableCategories: z.array(SLUG_PATTERN).min(1),
  descriptor: z.string().min(30).max(200),
  story: z.string().min(60).max(600),
  antiPatterns: z.array(z.string().min(1)).nullable().optional().default(null),
});

export const VibeReferencePoolSchema = z
  .object({
    version: z.literal(1),
    anchors: z.array(AnchorSchema),
    examples: z.array(ReferencePoolEntrySchema),
  })
  .superRefine((data, ctx) => {
    const anchorIds = new Set<string>();
    const seenLegacy = new Map<string, string>();
    for (const anchor of data.anchors) {
      if (anchorIds.has(anchor.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate anchor id: ${anchor.id}`,
          path: ["anchors"],
        });
      }
      anchorIds.add(anchor.id);
      for (const legacy of anchor.legacyLabels) {
        if (seenLegacy.has(legacy)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `legacy label "${legacy}" duplicated across anchors (${seenLegacy.get(legacy)} vs ${anchor.id})`,
            path: ["anchors"],
          });
        }
        seenLegacy.set(legacy, anchor.id);
      }
    }
    for (const example of data.examples) {
      for (const anchor of example.anchors) {
        if (!anchorIds.has(anchor)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `example "${example.id}" references unknown anchor "${anchor}"`,
            path: ["examples"],
          });
        }
      }
    }
  });

export type Anchor = z.infer<typeof AnchorSchema>;
export type ReferencePoolEntry = z.infer<typeof ReferencePoolEntrySchema>;
export type VibeReferencePool = z.infer<typeof VibeReferencePoolSchema>;

// ---------- Design Manifest (T008) ----------

const VibeSchema = z.object({
  descriptor: z.string().min(1).max(200),
  anchors: z.array(SLUG_PATTERN).min(1).max(2),
  story: z.string().min(1).max(600),
});

const CompositionEntrySchema = z
  .object({
    blockId: SLUG_PATTERN,
    variantId: SLUG_PATTERN,
    tier: TIER,
    position: z.number().int().min(0),
    rankRationale: z.string().max(400).nullable().optional().default(null),
  })
  .superRefine((entry, ctx) => {
    if (entry.tier === "high-impact" && (!entry.rankRationale || entry.rankRationale.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "high-impact entries must include a non-empty rankRationale",
        path: ["rankRationale"],
      });
    }
  });

export const BlocksManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    designVersion: z.number().int().min(1),
    shakeRevision: z.number().int().min(0),
    seed: z.string().regex(/^[a-f0-9]{64}$/),
    vibe: VibeSchema,
    composition: z.array(CompositionEntrySchema).min(1),
    generatedAt: z.string().datetime(),
    lastIntent: INTENT,
  })
  .superRefine((manifest, ctx) => {
    const positions = new Set<number>();
    for (const entry of manifest.composition) {
      if (positions.has(entry.position)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate position ${entry.position} in composition`,
          path: ["composition"],
        });
      }
      positions.add(entry.position);
    }
  });

export type Vibe = z.infer<typeof VibeSchema>;
export type CompositionEntry = z.infer<typeof CompositionEntrySchema>;
export type DesignManifest = z.infer<typeof BlocksManifestSchema>;
export type DesignIntent = z.infer<typeof INTENT>;
