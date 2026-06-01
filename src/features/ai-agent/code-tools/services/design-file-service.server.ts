import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

export type ProjectDesignRuleContext = {
  source: "project-design-md";
  projectId: string;
  path: "DESIGN.md";
  markdown: string;
  summary: string;
  loadedAt: string;
  hash: string;
};

export async function loadProjectDesignRules(input: {
  projectId: string;
  workspaceRoot: string;
}): Promise<ProjectDesignRuleContext> {
  const designPath = resolve(input.workspaceRoot, "DESIGN.md");

  try {
    await access(designPath);
  } catch {
    throw Object.assign(
      new Error(
        "DESIGN.md is missing in the project workspace. Generate it via generateAndWriteDesignFile during project init.",
      ),
      { code: "DESIGN_FILE_MISSING" },
    );
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
  return "Project-specific storefront design rules covering theme, palette, typography, spacing, components, layout, and responsive behavior.";
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
