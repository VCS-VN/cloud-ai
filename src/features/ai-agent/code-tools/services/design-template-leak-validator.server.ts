import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildProjectTokenIndex,
  type ProjectTokenIndex,
} from "@/features/ai-agent/code-tools/services/design-token-extractor.server";

export type SensitiveTokenSet = {
  paletteHexes: ReadonlySet<string>;
  paletteRgbValues: ReadonlySet<string>;
  fontFamilies: ReadonlySet<string>;
  radii: ReadonlySet<string>;
  shadows: ReadonlySet<string>;
};

export type AntiTemplateLeakVerdict =
  | { ok: true }
  | {
      ok: false;
      leaked: Array<{
        kind: "hex" | "rgb" | "font" | "radius" | "shadow";
        value: string;
        excerptLineHint?: number;
      }>;
    };

export type AntiTemplateLeakOptions = {
  honoredValues?: ReadonlySet<string>;
};

const TEMPLATE_RELATIVE_PATH = "templates/storefront/basic-ecommerce/DESIGN.md";

const NEUTRAL_HEX = new Set<string>([
  "#FFF",
  "#FFFF",
  "#FFFFFF",
  "#FFFFFFFF",
  "#000",
  "#0000",
  "#000000",
  "#000000FF",
]);

let cache: { mtimeMs: number; set: SensitiveTokenSet } | null = null;

export async function buildSensitiveTokenSet(
  templatePath?: string,
): Promise<SensitiveTokenSet> {
  const fullPath = resolve(process.cwd(), templatePath ?? TEMPLATE_RELATIVE_PATH);
  const fileStat = await stat(fullPath);
  if (cache && cache.mtimeMs === fileStat.mtimeMs) {
    return cache.set;
  }
  const content = await readFile(fullPath, "utf-8");
  const index = buildProjectTokenIndex(content);
  const set = filterNeutrals(index);
  cache = { mtimeMs: fileStat.mtimeMs, set };
  return set;
}

export function clearSensitiveTokenSetCache(): void {
  cache = null;
}

function filterNeutrals(index: ProjectTokenIndex): SensitiveTokenSet {
  const paletteHexes = new Set<string>();
  for (const value of index.hexes) {
    if (!NEUTRAL_HEX.has(value)) paletteHexes.add(value);
  }
  return {
    paletteHexes,
    paletteRgbValues: new Set(index.rgbValues),
    fontFamilies: new Set(index.fonts),
    radii: new Set(index.radii),
    shadows: new Set(index.shadows),
  };
}

export function validateAntiTemplateLeak(
  markdown: string,
  sensitive: SensitiveTokenSet,
  options: AntiTemplateLeakOptions = {},
): AntiTemplateLeakVerdict {
  const honored = normalizeHonored(options.honoredValues);
  const leaked: Array<{
    kind: "hex" | "rgb" | "font" | "radius" | "shadow";
    value: string;
    excerptLineHint?: number;
  }> = [];
  const seen = new Set<string>();

  const lines = markdown.split("\n");

  const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;
  const rgbRegex = /rgba?\([^)]+\)/gi;
  const fontFamilyRegex = /font-family:\s*([^;\n]+)/gi;
  const radiusValueInRoleBullet = /^- \*\*[^*]+\*\*\s*\(`([^`]+)`\):/;
  const shadowDeclarationRegex = /--shadow-[a-zA-Z0-9-]+:\s*([^\n]+);/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpExecArray | null;
    while ((match = hexRegex.exec(line)) !== null) {
      const candidate = `#${match[1]}`.toUpperCase();
      if (NEUTRAL_HEX.has(candidate)) continue;
      if (honored.has(candidate)) continue;
      if (sensitive.paletteHexes.has(candidate)) {
        recordLeak(leaked, seen, "hex", candidate, i + 1);
      }
    }
    while ((match = rgbRegex.exec(line)) !== null) {
      const compact = match[0].toLowerCase().replace(/\s+/g, "");
      if (honored.has(compact)) continue;
      if (sensitive.paletteRgbValues.has(compact)) {
        recordLeak(leaked, seen, "rgb", compact, i + 1);
      }
    }
    while ((match = fontFamilyRegex.exec(line)) !== null) {
      for (const part of match[1].split(",")) {
        const cleaned = part
          .trim()
          .replace(/^["']|["']$/g, "")
          .toLowerCase();
        if (!cleaned) continue;
        if (honored.has(cleaned)) continue;
        if (sensitive.fontFamilies.has(cleaned)) {
          recordLeak(leaked, seen, "font", cleaned, i + 1);
        }
      }
    }
    const roleBulletMatch = line.match(radiusValueInRoleBullet);
    if (roleBulletMatch) {
      // Already handled as hex/rgb above; nothing radius-specific in role bullets.
    }
  }

  // Radius leaks: check section 5 table values.
  let inSection5 = false;
  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^##\s+(\d+)\./);
    if (headingMatch) {
      inSection5 = headingMatch[1] === "5";
      continue;
    }
    if (!inSection5) continue;
    const tableValue = lines[i].match(/^\|\s*`([^`]+)`\s*\|/);
    if (tableValue) {
      const value = tableValue[1].trim().toLowerCase().replace(/\s+/g, "");
      if (honored.has(value)) continue;
      if (sensitive.radii.has(value)) {
        recordLeak(leaked, seen, "radius", value, i + 1);
      }
    }
  }

  // Shadows: check shadow declarations.
  let inCodeBlock = false;
  let shadowSection = false;
  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^##\s+(\d+)\./);
    if (headingMatch) {
      shadowSection = headingMatch[1] === "5";
      continue;
    }
    if (lines[i].trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (!shadowSection || !inCodeBlock) continue;
    let m: RegExpExecArray | null;
    const re = new RegExp(shadowDeclarationRegex.source, "g");
    while ((m = re.exec(lines[i])) !== null) {
      const compact = m[1].trim().toLowerCase().replace(/\s+/g, " ");
      if (honored.has(compact)) continue;
      if (sensitive.shadows.has(compact)) {
        recordLeak(leaked, seen, "shadow", compact, i + 1);
      }
    }
  }

  if (leaked.length === 0) return { ok: true };
  return { ok: false, leaked };
}

function normalizeHonored(values: ReadonlySet<string> | undefined): Set<string> {
  const out = new Set<string>();
  if (!values) return out;
  for (const raw of values) {
    if (!raw) continue;
    if (raw.startsWith("#")) {
      out.add(raw.toUpperCase());
    } else {
      out.add(raw.toLowerCase().trim());
    }
  }
  return out;
}

function recordLeak(
  leaked: Array<{
    kind: "hex" | "rgb" | "font" | "radius" | "shadow";
    value: string;
    excerptLineHint?: number;
  }>,
  seen: Set<string>,
  kind: "hex" | "rgb" | "font" | "radius" | "shadow",
  value: string,
  lineNumber: number,
): void {
  const dedupeKey = `${kind}:${value}`;
  if (seen.has(dedupeKey)) return;
  seen.add(dedupeKey);
  leaked.push({ kind, value, excerptLineHint: lineNumber });
}
