import { access, copyFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

export type StorefrontTemplateId =
  | "basic-ecommerce"
  | "ecommerce-fashion"
  | "ecommerce-electronics"
  | "ecommerce-cosmetics"
  | "ecommerce-single-product";

export type CopyDesignFileInput = {
  projectId: string;
  workspaceRoot: string;
  templateId?: StorefrontTemplateId;
  overwrite?: boolean;
};

export type CopyDesignFileResult = {
  copied: boolean;
  templateId: StorefrontTemplateId;
  sourcePath: string;
  destinationPath: "DESIGN.md";
  restoredExisting: boolean;
};

export type ProjectDesignRuleContext = {
  source: "project-design-md";
  projectId: string;
  path: "DESIGN.md";
  markdown: string;
  summary: string;
  loadedAt: string;
  hash: string;
};

export const DEFAULT_STOREFRONT_TEMPLATE_ID: StorefrontTemplateId = "basic-ecommerce";

export const STOREFRONT_TEMPLATE_DESIGN_PATHS: Record<StorefrontTemplateId, string> = {
  "basic-ecommerce": "templates/storefront/basic-ecommerce/DESIGN.md",
  "ecommerce-fashion": "templates/storefront/ecommerce-fashion/DESIGN.md",
  "ecommerce-electronics": "templates/storefront/ecommerce-electronics/DESIGN.md",
  "ecommerce-cosmetics": "templates/storefront/ecommerce-cosmetics/DESIGN.md",
  "ecommerce-single-product": "templates/storefront/ecommerce-single-product/DESIGN.md",
};

export function resolveDesignTemplatePath(templateId: StorefrontTemplateId): string {
  return STOREFRONT_TEMPLATE_DESIGN_PATHS[templateId];
}

export async function copyDesignFileToProject(input: CopyDesignFileInput): Promise<CopyDesignFileResult> {
  const templateId = input.templateId ?? DEFAULT_STOREFRONT_TEMPLATE_ID;
  const sourceRelative = resolveDesignTemplatePath(templateId);
  const sourcePath = resolve(process.cwd(), sourceRelative);
  const destinationPath = resolve(input.workspaceRoot, "DESIGN.md");

  let restoredExisting = false;

  try {
    await access(sourcePath);
  } catch {
    throw Object.assign(new Error(`Template DESIGN.md not found: ${sourceRelative}`), { code: "TEMPLATE_NOT_FOUND" });
  }

  try {
    await access(destinationPath);
    restoredExisting = true;
  } catch {
    restoredExisting = false;
  }

  if (!restoredExisting || input.overwrite) {
    await copyFile(sourcePath, destinationPath);
  }

  return {
    copied: !restoredExisting || !!input.overwrite,
    templateId,
    sourcePath: sourceRelative,
    destinationPath: "DESIGN.md",
    restoredExisting,
  };
}

export async function loadProjectDesignRules(input: {
  projectId: string;
  workspaceRoot: string;
  templateId?: StorefrontTemplateId;
}): Promise<ProjectDesignRuleContext> {
  const designPath = resolve(input.workspaceRoot, "DESIGN.md");

  try {
    await access(designPath);
  } catch {
    await copyDesignFileToProject({
      projectId: input.projectId,
      workspaceRoot: input.workspaceRoot,
      templateId: input.templateId,
    });
  }

  const markdown = await readFile(designPath, "utf-8");
  const hash = hashContent(markdown);
  const summary = summarizeDesignMarkdown(markdown);

  return {
    source: "project-design-md",
    projectId: input.projectId,
    path: "DESIGN.md",
    markdown,
    summary,
    loadedAt: new Date().toISOString(),
    hash,
  };
}

export function summarizeDesignMarkdown(_markdown: string): string {
  return "Retail storefront design rules for layout, typography, colors, spacing, components, and responsive behavior.";
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
