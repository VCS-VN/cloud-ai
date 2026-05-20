import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import type { WebsiteSpec } from "../../project/project-state.schema";
import type { OpenAIProvider } from "../../openai/openai-provider.server";
import {
  generateVisualDesignMarkdown,
  type DesignGenerationResult,
} from "./design-generation-service.server";
import {
  composeDesignMarkdown,
} from "./design-static-boilerplate.server";
import type { TokenHint } from "../../planning/design-intent-heuristic";

export type ProjectDesignRuleContext = {
  source: "project-design-md";
  projectId: string;
  path: "DESIGN.md";
  markdown: string;
  summary: string;
  loadedAt: string;
  hash: string;
};

export type GenerateDesignFileInput = {
  projectId: string;
  workspaceRoot: string;
  websiteSpec: WebsiteSpec;
  userPrompt: string;
  provider?: OpenAIProvider;
  model?: string;
  signal?: AbortSignal;
  tokenHints?: ReadonlyArray<TokenHint>;
  skipLeakValidation?: boolean;
};

export type GenerateDesignFileResult = {
  generated: true;
  source: DesignGenerationResult["source"];
  destinationPath: "DESIGN.md";
  hash: string;
  byteSize: number;
};

export async function generateAndWriteDesignFile(
  input: GenerateDesignFileInput,
): Promise<GenerateDesignFileResult> {
  const generation = await generateVisualDesignMarkdown({
    websiteSpec: input.websiteSpec,
    userPrompt: input.userPrompt,
    provider: input.provider,
    model: input.model,
    signal: input.signal,
    tokenHints: input.tokenHints,
    skipLeakValidation: input.skipLeakValidation,
  });

  const composed = composeDesignMarkdown(generation.visualMarkdown);
  const destinationPath = resolve(input.workspaceRoot, "DESIGN.md");
  await writeFile(destinationPath, composed, "utf-8");

  return {
    generated: true,
    source: generation.source,
    destinationPath: "DESIGN.md",
    hash: hashContent(composed),
    byteSize: Buffer.byteLength(composed, "utf-8"),
  };
}

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
