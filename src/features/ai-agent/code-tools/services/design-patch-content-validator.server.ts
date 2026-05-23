import type { ProjectTokenIndex } from "./design-token-extractor.server";
import { APPROVED_SEMANTIC_COLOR_UTILITIES } from "./design-token-schema.server";

export type PatchChangedFile = {
  path: string;
  content: string;
};

export type PatchContentScanInput = {
  changedFiles: ReadonlyArray<PatchChangedFile>;
  tokens: ProjectTokenIndex;
};

export type PatchContentVerdict =
  | { ok: true }
  | {
      ok: false;
      violations: Array<{
        filePath: string;
        literal: string;
        kind: "hex" | "rgb" | "hsl" | "oklch" | "tailwindColor" | "semanticColor" | "fontFamily" | "radius" | "shadow";
        lineHint?: number;
        suggestedRole?: string;
      }>;
    };

const NEUTRAL_HEXES = new Set<string>([
  "#FFF",
  "#FFFF",
  "#FFFFFF",
  "#FFFFFFFF",
  "#000",
  "#0000",
  "#000000",
  "#000000FF",
]);

const NEUTRAL_COLOR_KEYWORDS = new Set<string>([
  "transparent",
  "currentcolor",
  "inherit",
  "initial",
  "unset",
  "none",
  "white",
  "black",
]);

const NEUTRAL_FONT_TOKENS = new Set<string>([
  "system-ui",
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
  "sans-serif",
  "serif",
  "monospace",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "inherit",
  "initial",
  "unset",
]);

const NEUTRAL_RADIUS_VALUES = new Set<string>([
  "0",
  "0px",
  "0rem",
  "auto",
  "inherit",
  "initial",
  "unset",
]);

const HEX_REGEX = /#([0-9a-fA-F]{3,8})\b/g;
const RGB_REGEX = /\brgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)/gi;
const HSL_REGEX = /\bhsla?\([^)]+\)/gi;
const OKLCH_REGEX = /\boklch\([^)]+\)/gi;
const TAILWIND_FONT_REGEX = /font-\[(["'])([^"'\]]+)\1\]/g;
const FONT_FAMILY_INLINE_REGEX = /font-family\s*:\s*([^;\n]+)/gi;
const TAILWIND_RADIUS_REGEX = /rounded-\[([^\]]+)\]/g;
const INLINE_RADIUS_REGEX = /border-radius\s*:\s*([^;\n]+)/gi;
const TAILWIND_SHADOW_REGEX = /shadow-\[([^\]]+)\]/g;
const INLINE_SHADOW_REGEX = /box-shadow\s*:\s*([^;\n]+)/gi;
const TAILWIND_COLOR_UTILITY_REGEX = /\b(?:bg|text|border|ring|from|via|to)-([a-z]+(?:-[a-z]+)*)(?:-(?:50|100|200|300|400|500|600|700|800|900|950))?\b/g;
const APPROVED_COLOR_UTILITIES = new Set<string>(APPROVED_SEMANTIC_COLOR_UTILITIES);
const STRUCTURAL_COLOR_UTILITY_NAMES = new Set<string>(["transparent", "current", "white", "black"]);
const FOOTER_DEEP_SURFACE_PATTERN = /<footer[\s\S]*?className=(['"])[^'"]*\bbg-deep\b[^'"]*\btext-deep-foreground\b[^'"]*\1/;
const FOOTER_WRONG_SURFACE_PATTERN = /<footer[\s\S]*?className=(['"])[^'"]*\b(?:bg-card|bg-primary|bg-background|text-white|text-black)\b[^'"]*\1/;
const BOTTOM_CTA_PATTERN = /bottomCta|homeBottomCta|Ready for your next favorite|Sẵn sàng/i;
const BOTTOM_CTA_DEEP_PATTERN = /className=(['"])[^'"]*\bbg-deep\b[^'"]*\btext-deep-foreground\b[^'"]*\1/;
const BOTTOM_CTA_WRONG_SURFACE_PATTERN = /className=(['"])[^'"]*\b(?:bg-card|bg-primary|bg-background|text-white|text-black)\b[^'"]*\1/;

type PatchContentViolation = Extract<
  PatchContentVerdict,
  { ok: false }
>["violations"][number];

export function scanPatchContent(input: PatchContentScanInput): PatchContentVerdict {
  const violations: PatchContentViolation[] = [];

  for (const file of input.changedFiles) {
    if (!file.content) continue;
    const stripped = stripComments(file.content);
    const seen = new Set<string>();
    const lines = stripped.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      forEachMatch(line, HEX_REGEX, (match) => {
        const hex = `#${match[1]}`.toUpperCase();
        if (NEUTRAL_HEXES.has(hex)) return;
        if (input.tokens.hexes.has(hex)) return;
        pushViolation(
          violations,
          seen,
          file.path,
          hex,
          "hex",
          i + 1,
          suggestRoleForHex(input.tokens, hex),
        );
      });

      forEachMatch(line, RGB_REGEX, (match) => {
        const compact = match[0].toLowerCase().replace(/\s+/g, "");
        if (input.tokens.rgbValues.has(compact)) return;
        if (NEUTRAL_COLOR_KEYWORDS.has(compact)) return;
        pushViolation(violations, seen, file.path, compact, "rgb", i + 1);
      });

      forEachMatch(line, HSL_REGEX, (match) => {
        const compact = match[0].toLowerCase().replace(/\s+/g, "");
        if (input.tokens.rgbValues.has(compact)) return;
        pushViolation(violations, seen, file.path, compact, "hsl", i + 1);
      });

      forEachMatch(line, OKLCH_REGEX, (match) => {
        const compact = match[0].toLowerCase().replace(/\s+/g, "");
        if (input.tokens.rgbValues.has(compact)) return;
        pushViolation(violations, seen, file.path, compact, "oklch", i + 1);
      });


      forEachMatch(line, TAILWIND_COLOR_UTILITY_REGEX, (match) => {
        const role = match[1];
        if (APPROVED_COLOR_UTILITIES.has(role)) return;
        if (STRUCTURAL_COLOR_UTILITY_NAMES.has(role)) return;
        pushViolation(violations, seen, file.path, match[0], "tailwindColor", i + 1);
      });

      forEachMatch(line, TAILWIND_FONT_REGEX, (match) => {
        const family = match[2].toLowerCase().trim();
        if (NEUTRAL_FONT_TOKENS.has(family)) return;
        if (input.tokens.fonts.has(family)) return;
        pushViolation(violations, seen, file.path, family, "fontFamily", i + 1);
      });

      forEachMatch(line, FONT_FAMILY_INLINE_REGEX, (match) => {
        for (const part of match[1].split(",")) {
          const family = part.trim().replace(/^["']|["']$/g, "").toLowerCase();
          if (!family) continue;
          if (NEUTRAL_FONT_TOKENS.has(family)) continue;
          if (input.tokens.fonts.has(family)) continue;
          pushViolation(violations, seen, file.path, family, "fontFamily", i + 1);
        }
      });

      forEachMatch(line, TAILWIND_RADIUS_REGEX, (match) => {
        const value = match[1].trim().toLowerCase().replace(/\s+/g, "");
        if (NEUTRAL_RADIUS_VALUES.has(value)) return;
        if (input.tokens.radii.has(value)) return;
        pushViolation(violations, seen, file.path, value, "radius", i + 1);
      });

      forEachMatch(line, INLINE_RADIUS_REGEX, (match) => {
        const value = match[1].trim().toLowerCase().replace(/\s+/g, "");
        if (NEUTRAL_RADIUS_VALUES.has(value)) return;
        if (input.tokens.radii.has(value)) return;
        pushViolation(violations, seen, file.path, value, "radius", i + 1);
      });

      forEachMatch(line, TAILWIND_SHADOW_REGEX, (match) => {
        const value = match[1].trim().toLowerCase().replace(/\s+/g, " ");
        if (input.tokens.shadows.has(value)) return;
        pushViolation(violations, seen, file.path, value, "shadow", i + 1);
      });

      forEachMatch(line, INLINE_SHADOW_REGEX, (match) => {
        const value = match[1].trim().toLowerCase().replace(/\s+/g, " ");
        if (input.tokens.shadows.has(value)) return;
        pushViolation(violations, seen, file.path, value, "shadow", i + 1);
      });
    }

    pushSemanticSurfaceViolations(file, violations, seen);
  }

  if (violations.length === 0) return { ok: true };
  return {
    ok: false,
    violations,
  };
}

function pushSemanticSurfaceViolations(
  file: PatchChangedFile,
  violations: PatchContentViolation[],
  seen: Set<string>,
): void {
  if (isSiteFooterPath(file.path)) {
    if (!FOOTER_DEEP_SURFACE_PATTERN.test(file.content) || FOOTER_WRONG_SURFACE_PATTERN.test(file.content)) {
      pushViolation(
        violations,
        seen,
        file.path,
        "footer must use bg-deep text-deep-foreground",
        "semanticColor",
        findLine(file.content, /<footer/),
      );
    }
  }

  if (isHomeRoutePath(file.path) && BOTTOM_CTA_PATTERN.test(file.content)) {
    if (!BOTTOM_CTA_DEEP_PATTERN.test(file.content) || BOTTOM_CTA_WRONG_SURFACE_PATTERN.test(file.content)) {
      pushViolation(
        violations,
        seen,
        file.path,
        "bottom CTA must use bg-deep text-deep-foreground",
        "semanticColor",
        findLine(file.content, BOTTOM_CTA_PATTERN),
      );
    }
  }
}

function isSiteFooterPath(path: string): boolean {
  return /(^|\/)src\/components\/layout\/site-footer\.tsx$/.test(path);
}

function isHomeRoutePath(path: string): boolean {
  return /(^|\/)src\/routes\/index\.tsx$/.test(path);
}

function findLine(source: string, pattern: RegExp): number {
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i + 1;
  }
  return 1;
}

export function formatViolations(
  violations: Extract<PatchContentVerdict, { ok: false }>["violations"],
): string {
  const lines: string[] = [];
  lines.push(
    "Patch contains literals not declared in DESIGN.md. Resolve by either replacing with a declared token or updating DESIGN.md (token-level patch).",
  );
  for (const v of violations.slice(0, 12)) {
    const suggest = v.suggestedRole ? ` Suggested role: ${v.suggestedRole}.` : "";
    lines.push(
      `- ${v.filePath}${v.lineHint ? `:${v.lineHint}` : ""}: literal "${v.literal}" (${v.kind}).${suggest}`,
    );
  }
  if (violations.length > 12) {
    lines.push(`...and ${violations.length - 12} more.`);
  }
  return lines.join("\n");
}

function forEachMatch(
  line: string,
  pattern: RegExp,
  fn: (match: RegExpExecArray) => void,
): void {
  const re = new RegExp(pattern.source, pattern.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    fn(m);
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
}

function pushViolation(
  violations: PatchContentViolation[],
  seen: Set<string>,
  filePath: string,
  literal: string,
  kind: PatchContentViolation["kind"],
  lineHint: number,
  suggestedRole?: string,
): void {
  const key = `${filePath}:${kind}:${literal}`;
  if (seen.has(key)) return;
  seen.add(key);
  violations.push({ filePath, literal, kind, lineHint, suggestedRole });
}

function suggestRoleForHex(tokens: ProjectTokenIndex, hex: string): string | undefined {
  const roles = tokens.roleByValue.get(hex);
  if (roles && roles.length > 0) return roles[0];
  return undefined;
}

function stripComments(source: string): string {
  // remove /* ... */ block comments and // ... line comments
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => " ".repeat(match.length))
    .replace(/^(?:[^"'`\n]*?)(\/\/[^\n]*)$/gm, (_match, comment) => " ".repeat(comment.length));
}

export const NEUTRAL_LITERALS_WHITELIST = {
  hex: NEUTRAL_HEXES,
  colorKeywords: NEUTRAL_COLOR_KEYWORDS,
  fonts: NEUTRAL_FONT_TOKENS,
  radii: NEUTRAL_RADIUS_VALUES,
} as const;
