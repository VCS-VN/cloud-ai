import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { BlockLibrarySchema, type Block, type BlockLibrary } from "./blocks-manifest";
import { VerticalLayoutSpecSchema, type VerticalLayoutSpec } from "./vertical-layout-spec.schema";

export type { VerticalLayoutSpec, VerticalBlockConfig } from "./vertical-layout-spec.schema";
import type { LoaderOverrides } from "./library-loader.server";
import type { TemplateId } from "../source/template-registry.server";

function moduleDirectory() {
  if (typeof __dirname !== "undefined") return __dirname;
  return path.dirname(fileURLToPath(import.meta.url));
}

function resolveStorefrontTemplatesDir(): string {
  let dir = moduleDirectory();
  for (let i = 0; i < 10; i += 1) {
    const candidate = path.join(dir, "templates", "storefront");
    if (existsSync(path.join(candidate, "block-library.yaml"))) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(process.cwd(), "templates", "storefront");
}

const STOREFRONT_TEMPLATES_DIR = resolveStorefrontTemplatesDir();

const LAYOUT_SPEC_BY_TEMPLATE: Record<TemplateId, string> = {
  "ecommerce-basic": "ecommerce-basic/layout-spec.yaml",
  "ecommerce-fashion": "ecommerce-fashion/layout-spec.yaml",
  "ecommerce-electronics": "ecommerce-electronics/layout-spec.yaml",
  "ecommerce-cosmetics": "ecommerce-cosmetics/layout-spec.yaml",
  "ecommerce-grocery": "ecommerce-grocery/layout-spec.yaml",
  "ecommerce-nail": "ecommerce-nail/layout-spec.yaml",
  "ecommerce-single-product": "ecommerce-single-product/layout-spec.yaml",
};

export async function loadVerticalLayoutSpec(
  templateId: TemplateId,
  overrides: LoaderOverrides = {},
): Promise<VerticalLayoutSpec> {
  const relative = LAYOUT_SPEC_BY_TEMPLATE[templateId];
  if (!relative) {
    throw new Error(`No vertical layout spec mapped for templateId: ${templateId}`);
  }
  const filePath = path.join(STOREFRONT_TEMPLATES_DIR, relative);
  const text = await fs.readFile(filePath, "utf8");
  const raw = yaml.load(text, { filename: filePath });
  const spec = VerticalLayoutSpecSchema.parse(raw);
  if (spec.templateId !== templateId) {
    throw new Error(
      `layout-spec templateId mismatch: file declares ${spec.templateId}, expected ${templateId}`,
    );
  }
  const library = await loadBlockLibraryForVerticalValidation(overrides);
  validateVerticalAgainstLibrary(spec, library);
  return spec;
}

async function loadBlockLibraryForVerticalValidation(
  overrides: LoaderOverrides,
): Promise<BlockLibrary> {
  const storefrontDir = overrides.blockLibraryPath
    ? path.dirname(overrides.blockLibraryPath)
    : STOREFRONT_TEMPLATES_DIR;
  const filePath = overrides.blockLibraryPath ?? path.join(storefrontDir, "block-library.yaml");
  const text = await fs.readFile(filePath, "utf8");
  const raw = yaml.load(text, { filename: filePath });
  return BlockLibrarySchema.parse(raw);
}

function validateVerticalAgainstLibrary(
  spec: VerticalLayoutSpec,
  library: BlockLibrary,
) {
  const blocksById = new Map(library.blocks.map((b) => [b.blockId, b] as const));
  const referencedSlotIds = [
    ...spec.homepage.preferredOptionalSlots,
    ...spec.homepage.requiredOptionalSlots,
    ...spec.homepage.forbiddenSlots,
    ...(spec.homepage.preferredSocialProofBlocks ?? []),
  ];
  for (const blockId of referencedSlotIds) {
    if (!blocksById.has(blockId)) {
      throw new Error(`vertical layout references unknown blockId: ${blockId}`);
    }
  }
  for (const [blockId, cfg] of Object.entries(spec.blocks)) {
    const block = blocksById.get(blockId);
    if (!block) {
      throw new Error(`vertical layout block config references unknown blockId: ${blockId}`);
    }
    const variantIds = new Set(block.variants.map((v) => v.variantId));
    for (const variantId of cfg.allowedVariants) {
      if (!variantIds.has(variantId)) {
        throw new Error(
          `vertical layout ${spec.templateId}: block ${blockId} allows unknown variant ${variantId}`,
        );
      }
    }
    if (cfg.defaultVariant && !variantIds.has(cfg.defaultVariant)) {
      throw new Error(
        `vertical layout ${spec.templateId}: block ${blockId} defaultVariant ${cfg.defaultVariant} is invalid`,
      );
    }
  }
}

export function isBlockForbiddenForVertical(
  blockId: string,
  vertical: VerticalLayoutSpec,
): boolean {
  return vertical.homepage.forbiddenSlots.includes(blockId);
}

export function applyVerticalVariantFilter(
  block: Block,
  vertical: VerticalLayoutSpec,
): Block | null {
  if (isBlockForbiddenForVertical(block.blockId, vertical)) {
    return null;
  }
  const cfg = vertical.blocks[block.blockId];
  if (!cfg) {
    return block;
  }
  const allowed = new Set(cfg.allowedVariants);
  const variants = block.variants.filter((v) => allowed.has(v.variantId));
  if (variants.length === 0) {
    return null;
  }
  return { ...block, variants };
}

export function formatVerticalLayoutSummary(vertical: VerticalLayoutSpec): string {
  const optional = [
    ...vertical.homepage.requiredOptionalSlots,
    ...vertical.homepage.preferredOptionalSlots,
  ].join(", ");
  const forbidden = vertical.homepage.forbiddenSlots.join(", ") || "none";
  return [
    `Vertical: ${vertical.verticalLabel} (${vertical.templateId})`,
    `Homepage rhythm: ${vertical.homepage.rhythm}`,
    `Preferred/required optional blocks: ${optional || "library defaults"}`,
    `Forbidden blocks: ${forbidden}`,
    `Override policy: allowUserOverride=${vertical.overrides.allowUserOverride}`,
  ].join("\n");
}
