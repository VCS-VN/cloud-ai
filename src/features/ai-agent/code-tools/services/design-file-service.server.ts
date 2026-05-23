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
import { buildDeterministicDesignSeed, type TokenHint } from "../../planning/design-intent-heuristic";
import { validateManagedDesignFile } from "./design-file-validator.server";

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

  const composed = prependManagedTokenBlock(
    composeDesignMarkdown(generation.visualMarkdown),
    input,
    generation.source,
  );
  const validation = validateManagedDesignFile(composed);
  if (!validation.ok) {
    throw Object.assign(
      new Error(
        `Generated DESIGN.md failed validation: ${validation.violations
          .map((v) => v.message)
          .join("; ")}`,
      ),
      { code: "DESIGN_FILE_VALIDATION_FAILED", details: validation.violations },
    );
  }
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


function prependManagedTokenBlock(
  markdown: string,
  input: GenerateDesignFileInput,
  source: DesignGenerationResult["source"],
): string {
  if (markdown.trimStart().startsWith("---")) return markdown;
  const palette = pickManagedPalette(`${input.projectId}:${input.userPrompt}`);
  const intent = {
    category: normalizeDesignFact(input.websiteSpec.store.type, "retail"),
    audience: normalizeDesignFact(input.websiteSpec.store.targetCustomers, "retail shoppers"),
    priceTier: inferPriceTier(input.websiteSpec),
    archetype: palette.archetype,
    mood: palette.mood,
    seed: buildDeterministicDesignSeed({ projectId: input.projectId, prompt: input.userPrompt }),
    source: source === "fallback" ? "fallback" : "init_prompt",
  };
  const yaml = [
    "---",
    "designIntent:",
    `  category: ${quoteYaml(intent.category)}`,
    `  audience: ${quoteYaml(intent.audience)}`,
    `  priceTier: ${quoteYaml(intent.priceTier)}`,
    `  archetype: ${quoteYaml(intent.archetype)}`,
    `  mood: [${intent.mood.map(quoteYaml).join(", ")}]`,
    `  seed: ${quoteYaml(intent.seed)}`,
    `  source: ${quoteYaml(intent.source)}`,
    "tokens:",
    "  colors:",
    ...Object.entries(palette.colors).flatMap(([key, value]) => [
      `    ${key}:`,
      `      value: ${quoteYaml(value)}`,
      `      provenance: ${source === "fallback" ? "fallback-agent" : "agent"}`,
      `      role: ${quoteYaml(colorRole(key))}`,
    ]),
    "---",
    "",
  ].join("\n");
  return `${yaml}${markdown}`;
}

type ManagedPalette = {
  archetype: string;
  mood: string[];
  colors: Record<string, string>;
};

function pickManagedPalette(seed: string): ManagedPalette {
  const palettes: ManagedPalette[] = [
    {
      archetype: "crisp modern retail",
      mood: ["clear", "confident", "fresh"],
      colors: {
        primary: "#1746A2",
        "primary-foreground": "#FFFFFF",
        accent: "#E85D04",
        "accent-foreground": "#FFFFFF",
        highlight: "#F4B400",
        "highlight-foreground": "#1F1300",
        background: "#F7F9FC",
        surface: "#FFFFFF",
        "surface-muted": "#E9EEF6",
        foreground: "#111827",
        "muted-foreground": "#4B5563",
        border: "#CBD5E1",
        success: "#166534",
        warning: "#92400E",
        error: "#B91C1C",
      },
    },
    {
      archetype: "soft premium editorial",
      mood: ["warm", "refined", "calm"],
      colors: {
        primary: "#5B2333",
        "primary-foreground": "#FFFFFF",
        accent: "#A65F3D",
        "accent-foreground": "#FFFFFF",
        highlight: "#D6A85A",
        "highlight-foreground": "#221400",
        background: "#FBF7F1",
        surface: "#FFFFFF",
        "surface-muted": "#EFE5D8",
        foreground: "#221A16",
        "muted-foreground": "#67564B",
        border: "#D8C8B8",
        success: "#2F6B3F",
        warning: "#8A5A00",
        error: "#A62821",
      },
    },
    {
      archetype: "playful bright market",
      mood: ["energetic", "friendly", "bold"],
      colors: {
        primary: "#0F766E",
        "primary-foreground": "#FFFFFF",
        accent: "#C026D3",
        "accent-foreground": "#FFFFFF",
        highlight: "#FACC15",
        "highlight-foreground": "#1A1600",
        background: "#F8FAFC",
        surface: "#FFFFFF",
        "surface-muted": "#E0F2FE",
        foreground: "#0F172A",
        "muted-foreground": "#475569",
        border: "#BAE6FD",
        success: "#15803D",
        warning: "#A16207",
        error: "#BE123C",
      },
    },
  ];
  const index = Number.parseInt(hashContent(seed).slice(0, 8), 16) % palettes.length;
  return palettes[index];
}

function normalizeDesignFact(value: unknown, fallback: string): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ") || fallback;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function inferPriceTier(input: WebsiteSpec): string {
  const text = `${input.store.description} ${input.brand.tone} ${input.brand.visualStyle}`.toLowerCase();
  if (/luxury|premium|cao cấp|sang trọng/.test(text)) return "premium";
  if (/budget|value|cheap|giá rẻ/.test(text)) return "value";
  return "mid-market";
}

function quoteYaml(value: string): string {
  return JSON.stringify(value);
}

function colorRole(key: string): string {
  return `${key} storefront design token`;
}
