import { parseDesignTokenBlock } from "./design-file-validator.server";
import { readTokenValue } from "./design-token-schema.server";

export const DESIGN_TOKENS_START = "/* DESIGN_TOKENS_START */";
export const DESIGN_TOKENS_END = "/* DESIGN_TOKENS_END */";

export type TokenMappingResult =
  | { ok: true; content: string }
  | { ok: false; message: string };

export function buildCssVariableMapping(designMarkdown: string): string {
  const block = parseDesignTokenBlock(designMarkdown);
  const colors = block?.tokens?.colors ?? {};
  const lines = [":root {"];
  const map: Array<[string, string]> = [
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
    ["deep", "primary"],
    ["deep-foreground", "primary-foreground"],
  ];
  for (const [semantic, tokenKey] of map) {
    const value = readTokenValue(colors[tokenKey]);
    if (value) lines.push(`  --${semantic}: ${value};`);
  }
  lines.push("}");
  return lines.join("\n");
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
