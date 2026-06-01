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
import { contrastRatioForHex } from "./design-color-contrast.server";
import type { DesignDials } from "./design-token-schema.server";

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
  dials?: DesignDials;
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
  const dials = input.dials;
  const intent = {
    category: normalizeDesignFact(input.websiteSpec.store.type, "retail"),
    audience: normalizeDesignFact(input.websiteSpec.store.targetCustomers, "retail shoppers"),
    priceTier: inferPriceTier(input.websiteSpec),
    archetype: palette.archetype,
    mood: palette.mood,
    seed: buildDeterministicDesignSeed({ projectId: input.projectId, prompt: input.userPrompt }),
    source: source === "fallback" ? "fallback" : "init_prompt",
  };
  const provenance = source === "fallback" ? "fallback-agent" : "agent";
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
    ...(dials
      ? [
          `  variance: ${dials.variance}`,
          `  motion: ${dials.motion}`,
          `  density: ${dials.density}`,
          `  designRead: ${quoteYaml(dials.designRead)}`,
          `  colorLock: ${quoteYaml(dials.colorLock)}`,
          `  radiusLock: ${quoteYaml(dials.radiusLock)}`,
          `  themeLock: ${quoteYaml(dials.themeLock)}`,
        ]
      : []),
    "tokens:",
    "  colors:",
    ...Object.entries(palette.colors).flatMap(([key, value]) => [
      `    ${key}:`,
      `      value: ${quoteYaml(value)}`,
      ...(palette.colorsDark[key]
        ? [`      valueDark: ${quoteYaml(palette.colorsDark[key])}`]
        : []),
      `      provenance: ${provenance}`,
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
  colorsDark: Record<string, string>;
};


const MANAGED_PALETTE_CONTRAST_PAIRS: Array<[string, string]> = [
  ["primary-foreground", "primary"],
  ["accent-foreground", "accent"],
  ["highlight-foreground", "highlight"],
  ["foreground", "background"],
  ["foreground", "surface"],
  ["foreground", "surface-muted"],
];

/**
 * Validates that all required contrast pairs in a managed palette meet 4.5:1,
 * for BOTH the light (colors) and dark (colorsDark) maps. Returns the palette
 * unchanged if valid, or logs a warning and returns null if invalid.
 */
function validateManagedPalette(palette: ManagedPalette): ManagedPalette | null {
  for (const [mode, map] of [
    ["light", palette.colors],
    ["dark", palette.colorsDark],
  ] as const) {
    for (const [fgKey, bgKey] of MANAGED_PALETTE_CONTRAST_PAIRS) {
      const fg = map[fgKey];
      const bg = map[bgKey];
      if (!fg || !bg) continue;
      const ratio = contrastRatioForHex(fg, bg);
      if (ratio === null) continue;
      if (ratio < 4.5) {
        console.warn(
          JSON.stringify({
            event: "managed_palette_contrast_failed",
            archetype: palette.archetype,
            mode,
            pair: `${fgKey}/${bgKey}`,
            ratio: Number(ratio.toFixed(2)),
            fg,
            bg,
          }),
        );
        return null;
      }
    }
  }
  return palette;
}

function pickManagedPalette(seed: string): ManagedPalette {
  const palettes: ManagedPalette[] = [
    {
      archetype: "crisp modern retail",
      mood: ["clear", "confident", "fresh"],
      colors: {
        primary: "#1746A2",
        "primary-foreground": "#FFFFFF",
        accent: "#B45309",
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
      colorsDark: {
        primary: "#1746A2",
        "primary-foreground": "#FFFFFF",
        accent: "#B45309",
        "accent-foreground": "#FFFFFF",
        highlight: "#F4B400",
        "highlight-foreground": "#1F1300",
        background: "#0B0F19",
        surface: "#151B27",
        "surface-muted": "#1F2837",
        foreground: "#F3F4F6",
        "muted-foreground": "#9CA3AF",
        border: "#2A3340",
        success: "#22C55E",
        warning: "#F59E0B",
        error: "#F87171",
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
      colorsDark: {
        primary: "#5B2333",
        "primary-foreground": "#FFFFFF",
        accent: "#A65F3D",
        "accent-foreground": "#FFFFFF",
        highlight: "#D6A85A",
        "highlight-foreground": "#221400",
        background: "#161109",
        surface: "#211A12",
        "surface-muted": "#2B2218",
        foreground: "#F4ECE0",
        "muted-foreground": "#B7A998",
        border: "#3A2E20",
        success: "#4ADE80",
        warning: "#FBBF24",
        error: "#F87171",
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
      colorsDark: {
        primary: "#0F766E",
        "primary-foreground": "#FFFFFF",
        accent: "#C026D3",
        "accent-foreground": "#FFFFFF",
        highlight: "#FACC15",
        "highlight-foreground": "#1A1600",
        background: "#0A1018",
        surface: "#121A24",
        "surface-muted": "#1B2533",
        foreground: "#F1F5F9",
        "muted-foreground": "#94A3B8",
        border: "#27323F",
        success: "#22C55E",
        warning: "#FBBF24",
        error: "#FB7185",
      },
    },
  ];
  const index = Number.parseInt(hashContent(seed).slice(0, 8), 16) % palettes.length;
  const picked = palettes[index];
  const validated = validateManagedPalette(picked);
  if (validated) return validated;

  // Fallback: tìm palette đầu tiên pass contrast, nếu không có thì dùng palette 2 (đã verified an toàn)
  for (const p of palettes) {
    if (p === picked) continue;
    const alt = validateManagedPalette(p);
    if (alt) {
      console.warn(
        JSON.stringify({
          event: "managed_palette_fallback_used",
          original: picked.archetype,
          fallback: alt.archetype,
        }),
      );
      return alt;
    }
  }
  // Should never reach here since palette 2 is verified safe.
  return palettes[1];
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
