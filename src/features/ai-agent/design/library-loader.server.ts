import { promises as fs } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import {
  BlockLibrarySchema,
  CategoryTaxonomySchema,
  VibeReferencePoolSchema,
  type BlockLibrary,
  type CategoryTaxonomy,
  type VibeReferencePool,
} from "./blocks-manifest";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const STOREFRONT_DIR = path.join(REPO_ROOT, "templates", "storefront");

const DEFAULT_PATHS = {
  blockLibrary: path.join(STOREFRONT_DIR, "block-library.yaml"),
  categories: path.join(STOREFRONT_DIR, "categories.yaml"),
  referencePool: path.join(STOREFRONT_DIR, "vibe-reference-pool.yaml"),
};

type Cached<T> = { value: T; mtime: number };

const cache = {
  blockLibrary: undefined as Cached<BlockLibrary> | undefined,
  categories: undefined as Cached<CategoryTaxonomy> | undefined,
  referencePool: undefined as Cached<VibeReferencePool> | undefined,
};

async function readYaml<T>(filePath: string): Promise<{ raw: unknown; mtime: number }> {
  const stat = await fs.stat(filePath);
  const text = await fs.readFile(filePath, "utf8");
  const raw = yaml.load(text, { filename: filePath });
  return { raw, mtime: stat.mtimeMs };
}

export interface LoaderOverrides {
  blockLibraryPath?: string;
  categoriesPath?: string;
  referencePoolPath?: string;
  forceReload?: boolean;
}

export async function loadCategoryTaxonomy(overrides: LoaderOverrides = {}): Promise<CategoryTaxonomy> {
  const filePath = overrides.categoriesPath ?? DEFAULT_PATHS.categories;
  if (!overrides.forceReload && cache.categories && filePath === DEFAULT_PATHS.categories) {
    return cache.categories.value;
  }
  const { raw, mtime } = await readYaml(filePath);
  const parsed = CategoryTaxonomySchema.parse(raw);
  validateSubcategoryTotal(parsed);
  if (filePath === DEFAULT_PATHS.categories) {
    cache.categories = { value: parsed, mtime };
  }
  return parsed;
}

export async function loadReferencePool(overrides: LoaderOverrides = {}): Promise<VibeReferencePool> {
  const filePath = overrides.referencePoolPath ?? DEFAULT_PATHS.referencePool;
  if (!overrides.forceReload && cache.referencePool && filePath === DEFAULT_PATHS.referencePool) {
    return cache.referencePool.value;
  }
  const { raw, mtime } = await readYaml(filePath);
  const parsed = VibeReferencePoolSchema.parse(raw);
  if (filePath === DEFAULT_PATHS.referencePool) {
    cache.referencePool = { value: parsed, mtime };
  }
  return parsed;
}

export async function loadBlockLibrary(overrides: LoaderOverrides = {}): Promise<BlockLibrary> {
  const filePath = overrides.blockLibraryPath ?? DEFAULT_PATHS.blockLibrary;
  if (!overrides.forceReload && cache.blockLibrary && filePath === DEFAULT_PATHS.blockLibrary) {
    return cache.blockLibrary.value;
  }
  const [{ raw, mtime }, taxonomy, pool] = await Promise.all([
    readYaml(filePath),
    loadCategoryTaxonomy(overrides),
    loadReferencePool(overrides),
  ]);
  const parsed = BlockLibrarySchema.parse(raw);
  validateBlockLibraryCrossRefs(parsed, taxonomy, pool);
  if (filePath === DEFAULT_PATHS.blockLibrary) {
    cache.blockLibrary = { value: parsed, mtime };
  }
  return parsed;
}

export function clearLoaderCache(): void {
  cache.blockLibrary = undefined;
  cache.categories = undefined;
  cache.referencePool = undefined;
}

function validateSubcategoryTotal(taxonomy: CategoryTaxonomy): void {
  const total = taxonomy.primary.reduce((sum, p) => sum + p.subcategories.length, 0);
  if (total < 60) {
    throw new Error(
      `Category taxonomy too small: ${total} subcategories (expected >= 60 to satisfy block library coverage; target ~80-120)`,
    );
  }
}

function validateBlockLibraryCrossRefs(
  library: BlockLibrary,
  taxonomy: CategoryTaxonomy,
  pool: VibeReferencePool,
): void {
  const primaryIds = new Set(taxonomy.primary.map((p) => p.id));
  const subcategoryIds = new Set<string>();
  for (const primary of taxonomy.primary) {
    for (const sub of primary.subcategories) {
      subcategoryIds.add(`${primary.id}/${sub.id}`);
    }
  }
  const anchorIds = new Set(pool.anchors.map((a) => a.id));
  const blockIds = new Set(library.blocks.map((b) => b.blockId));

  const errors: string[] = [];
  for (const block of library.blocks) {
    if (block.applicableCategories) {
      for (const cat of block.applicableCategories) {
        if (!primaryIds.has(cat)) {
          errors.push(`block ${block.blockId} references unknown primary category "${cat}"`);
        }
      }
    }
    if (block.applicableSubcategories) {
      for (const sub of block.applicableSubcategories) {
        if (!sub.includes("/")) {
          errors.push(
            `block ${block.blockId} subcategory "${sub}" must be in form <primary>/<sub>`,
          );
          continue;
        }
        if (!subcategoryIds.has(sub)) {
          errors.push(`block ${block.blockId} references unknown subcategory "${sub}"`);
        }
      }
    }
    if (block.applicableVibes) {
      for (const v of block.applicableVibes) {
        if (!anchorIds.has(v)) {
          errors.push(`block ${block.blockId} references unknown anchor "${v}"`);
        }
      }
    }
    for (const variant of block.variants) {
      for (const anchor of Object.keys(variant.vibeAffinity)) {
        if (!anchorIds.has(anchor)) {
          errors.push(
            `block ${block.blockId} variant ${variant.variantId} references unknown anchor "${anchor}"`,
          );
        }
      }
    }
    const ruleArrays: ReadonlyArray<keyof typeof block.compositionRules> = [
      "mustPrecede",
      "mustFollow",
      "mutuallyExclusive",
    ];
    for (const key of ruleArrays) {
      const arr = block.compositionRules[key];
      if (Array.isArray(arr)) {
        for (const ref of arr) {
          if (!blockIds.has(ref)) {
            errors.push(
              `block ${block.blockId}.compositionRules.${key} references unknown blockId "${ref}"`,
            );
          }
        }
      }
    }
  }

  const tier1Positions = new Map<number, string>();
  for (const block of library.blocks) {
    if (block.requirementLevel === "tier-1" && typeof block.defaultPosition === "number") {
      const existing = tier1Positions.get(block.defaultPosition);
      if (existing) {
        errors.push(
          `tier-1 blocks ${existing} and ${block.blockId} share defaultPosition ${block.defaultPosition}`,
        );
      }
      tier1Positions.set(block.defaultPosition, block.blockId);
    }
  }

  const groups = new Map<string, number>();
  for (const block of library.blocks) {
    if (block.requirementLevel === "group" && block.requirementGroup) {
      groups.set(block.requirementGroup, (groups.get(block.requirementGroup) ?? 0) + 1);
    }
  }
  if (!groups.has("social-proof") || (groups.get("social-proof") ?? 0) === 0) {
    errors.push("block library must declare at least one block in requirementGroup=social-proof");
  }

  if (errors.length > 0) {
    throw new Error(`Block library cross-asset validation failed:\n - ${errors.join("\n - ")}`);
  }
}

export const STOREFRONT_PATHS = DEFAULT_PATHS;
