import { parseDesignTokenBlock } from "./design-file-validator.server";
import { readTokenValue, readTokenValueDark } from "./design-token-schema.server";

export const DESIGN_TOKENS_START = "/* DESIGN_TOKENS_START */";
export const DESIGN_TOKENS_END = "/* DESIGN_TOKENS_END */";

export type TokenMappingResult =
  | { ok: true; content: string }
  | { ok: false; message: string };

const SEMANTIC_TOKEN_MAP: Array<[string, string[]]> = [
  ["background", ["background"]],
  ["foreground", ["foreground"]],
  ["card", ["card", "surface"]],
  ["card-foreground", ["card-foreground", "foreground"]],
  ["popover", ["popover", "card", "surface"]],
  ["popover-foreground", ["popover-foreground", "foreground"]],
  ["primary", ["primary"]],
  ["primary-foreground", ["primary-foreground"]],
  ["secondary", ["secondary", "surface-muted", "muted"]],
  ["secondary-foreground", ["secondary-foreground", "foreground"]],
  ["muted", ["muted", "surface-muted", "secondary"]],
  ["muted-foreground", ["muted-foreground"]],
  ["accent", ["accent"]],
  ["accent-foreground", ["accent-foreground"]],
  ["destructive", ["destructive", "error"]],
  ["destructive-foreground", ["destructive-foreground", "primary-foreground"]],
  ["border", ["border"]],
  ["input", ["input", "border"]],
  ["ring", ["ring", "primary"]],
  ["highlight", ["highlight"]],
  ["highlight-foreground", ["highlight-foreground"]],
  ["success", ["success"]],
  ["warning", ["warning"]],
  ["error", ["error", "destructive"]],
];

const REQUIRED_CSS_VARIABLES = [
  "background",
  "foreground",
  "primary",
  "primary-foreground",
  "border",
] as const;

export function buildCssVariableMapping(designMarkdown: string): string {
  const block = parseDesignTokenBlock(designMarkdown);
  const colors = block?.tokens?.colors ?? {};
  const radius = block?.tokens?.radius ?? {};

  const deepSurface =
    readMarkdownRoleValue(designMarkdown, ["Deep Brand", "Dark Surface", "Deep Surface"]) ??
    readTokenValue(colors.primary);
  const deepForeground =
    readMarkdownRoleValue(designMarkdown, ["Text On Dark"]) ??
    readTokenValue(colors["primary-foreground"]);

  const lightLines = [":root {"];
  for (const [semantic, tokenKeys] of SEMANTIC_TOKEN_MAP) {
    const value = readFirstTokenValue(colors, tokenKeys);
    if (value) lightLines.push(`  --${semantic}: ${value};`);
  }
  if (deepSurface) lightLines.push(`  --deep: ${deepSurface};`);
  if (deepForeground) lightLines.push(`  --deep-foreground: ${deepForeground};`);
  const radiusValue =
    readTokenValue(radius.lg) ??
    readTokenValue(radius.md) ??
    readTokenValue(radius.pill);
  if (radiusValue) lightLines.push(`  --radius: ${radiusValue};`);
  lightLines.push("}");

  // Dark block: emit only when at least one token declares valueDark.
  // Each var falls back to its light value so partial dark coverage stays coherent.
  const hasDark = SEMANTIC_TOKEN_MAP.some(([, tokenKeys]) =>
    readFirstTokenValueDark(colors, tokenKeys),
  );
  if (!hasDark) {
    return lightLines.join("\n");
  }

  const darkLines = [".dark {"];
  for (const [semantic, tokenKeys] of SEMANTIC_TOKEN_MAP) {
    const value =
      readFirstTokenValueDark(colors, tokenKeys) ??
      readFirstTokenValue(colors, tokenKeys);
    if (value) darkLines.push(`  --${semantic}: ${value};`);
  }
  const deepDark = readTokenValueDark(colors.background) ?? deepSurface;
  if (deepDark) darkLines.push(`  --deep: ${deepDark};`);
  if (deepForeground) darkLines.push(`  --deep-foreground: ${deepForeground};`);
  darkLines.push("}");

  return `${lightLines.join("\n")}\n${darkLines.join("\n")}`;
}

export function validateCssVariableMapping(mapping: string): {
  ok: boolean;
  missingVariables: string[];
} {
  const missingVariables = REQUIRED_CSS_VARIABLES.filter(
    (name) => !new RegExp(`--${escapeRegex(name)}:\\s*[^;\\s][^;]*;`).test(mapping),
  );
  return { ok: missingVariables.length === 0, missingVariables };
}

function readFirstTokenValue(
  tokens: Record<string, Parameters<typeof readTokenValue>[0]>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = readTokenValue(tokens[key]);
    if (value) return value;
  }
  return undefined;
}

function readFirstTokenValueDark(
  tokens: Record<string, Parameters<typeof readTokenValueDark>[0]>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = readTokenValueDark(tokens[key]);
    if (value) return value;
  }
  return undefined;
}

function readMarkdownRoleValue(
  markdown: string,
  roleNames: ReadonlyArray<string>,
): string | undefined {
  for (const role of roleNames) {
    const escaped = role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = markdown.match(
      new RegExp(`- \\*\\*${escaped}\\*\\* \\(\\\`([^\\\`]+)\\\`\\):`, "i"),
    );
    const value = match?.[1]?.trim();
    if (value) return value;
  }
  return undefined;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function replaceOwnedDesignTokenRegion(
  content: string,
  generatedMapping: string,
): TokenMappingResult {
  const start = content.indexOf(DESIGN_TOKENS_START);
  const end = content.indexOf(DESIGN_TOKENS_END);
  if (start === -1 || end === -1 || end < start) {
    return {
      ok: false,
      message: "Token mapping file is missing DESIGN_TOKENS_START / DESIGN_TOKENS_END markers.",
    };
  }
  const before = content.slice(0, start + DESIGN_TOKENS_START.length);
  const after = content.slice(end);
  return { ok: true, content: `${before}\n${generatedMapping}\n${after}` };
}
