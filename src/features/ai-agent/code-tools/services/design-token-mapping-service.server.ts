import { parseDesignTokenBlock } from "./design-file-validator.server";
import { readTokenValue, readTokenValueDark } from "./design-token-schema.server";

export const DESIGN_TOKENS_START = "/* DESIGN_TOKENS_START */";
export const DESIGN_TOKENS_END = "/* DESIGN_TOKENS_END */";

export type TokenMappingResult =
  | { ok: true; content: string }
  | { ok: false; message: string };

const SEMANTIC_TOKEN_MAP: Array<[string, string]> = [
  ["background", "background"],
  ["foreground", "foreground"],
  ["card", "surface"],
  ["card-foreground", "foreground"],
  ["popover", "surface"],
  ["popover-foreground", "foreground"],
  ["primary", "primary"],
  ["primary-foreground", "primary-foreground"],
  ["secondary", "surface-muted"],
  ["secondary-foreground", "foreground"],
  ["muted", "surface-muted"],
  ["muted-foreground", "muted-foreground"],
  ["accent", "accent"],
  ["accent-foreground", "accent-foreground"],
  ["destructive", "error"],
  ["destructive-foreground", "primary-foreground"],
  ["border", "border"],
  ["input", "border"],
  ["ring", "primary"],
  ["highlight", "highlight"],
  ["highlight-foreground", "highlight-foreground"],
  ["success", "success"],
  ["warning", "warning"],
  ["error", "error"],
];

export function buildCssVariableMapping(designMarkdown: string): string {
  const block = parseDesignTokenBlock(designMarkdown);
  const colors = block?.tokens?.colors ?? {};

  const deepSurface =
    readMarkdownRoleValue(designMarkdown, ["Deep Brand", "Dark Surface", "Deep Surface"]) ??
    readTokenValue(colors.primary);
  const deepForeground =
    readMarkdownRoleValue(designMarkdown, ["Text On Dark"]) ??
    readTokenValue(colors["primary-foreground"]);

  const lightLines = [":root {"];
  for (const [semantic, tokenKey] of SEMANTIC_TOKEN_MAP) {
    const value = readTokenValue(colors[tokenKey]);
    if (value) lightLines.push(`  --${semantic}: ${value};`);
  }
  if (deepSurface) lightLines.push(`  --deep: ${deepSurface};`);
  if (deepForeground) lightLines.push(`  --deep-foreground: ${deepForeground};`);
  lightLines.push("}");

  // Dark block: emit only when at least one token declares valueDark.
  // Each var falls back to its light value so partial dark coverage stays coherent.
  const hasDark = SEMANTIC_TOKEN_MAP.some(([, tokenKey]) => readTokenValueDark(colors[tokenKey]));
  if (!hasDark) {
    return lightLines.join("\n");
  }

  const darkLines = [".dark {"];
  for (const [semantic, tokenKey] of SEMANTIC_TOKEN_MAP) {
    const value = readTokenValueDark(colors[tokenKey]) ?? readTokenValue(colors[tokenKey]);
    if (value) darkLines.push(`  --${semantic}: ${value};`);
  }
  const deepDark = readTokenValueDark(colors.background) ?? deepSurface;
  if (deepDark) darkLines.push(`  --deep: ${deepDark};`);
  if (deepForeground) darkLines.push(`  --deep-foreground: ${deepForeground};`);
  darkLines.push("}");

  return `${lightLines.join("\n")}\n${darkLines.join("\n")}`;
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
