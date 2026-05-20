import { createHash } from "node:crypto";

export type ProjectTokenIndex = {
  hexes: ReadonlySet<string>;
  rgbValues: ReadonlySet<string>;
  fonts: ReadonlySet<string>;
  radii: ReadonlySet<string>;
  shadows: ReadonlySet<string>;
  roleByValue: ReadonlyMap<string, string[]>;
  hash: string;
};

const SECTION_HEADING_PATTERN = /^##\s+(\d+)\.\s+/;
const PALETTE_BULLET_PATTERN = /^- \*\*([^*]+)\*\*\s*\(`([^`]+)`\):/;
const RADIUS_TABLE_ROW_PATTERN = /^\|\s*`([^`]+)`\s*\|/;
const SHADOW_LINE_PATTERN = /^--shadow-[a-zA-Z0-9-]+:\s*(.+);\s*$/;
const FONT_FAMILY_LINE_PATTERN = /^font-family:\s*([^;]+);?\s*$/i;

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
]);

const cache = new Map<string, ProjectTokenIndex>();

export function buildProjectTokenIndex(designMarkdown: string): ProjectTokenIndex {
  const hash = createHash("sha256").update(designMarkdown).digest("hex");
  const cached = cache.get(hash);
  if (cached) return cached;

  const lines = designMarkdown.split("\n");
  const hexes = new Set<string>();
  const rgbValues = new Set<string>();
  const fonts = new Set<string>();
  const radii = new Set<string>();
  const shadows = new Set<string>();
  const roleByValue = new Map<string, string[]>();

  let currentSection = 0;
  let inCodeBlock = false;

  for (const rawLine of lines) {
    const line = rawLine;
    const headingMatch = line.match(SECTION_HEADING_PATTERN);
    if (headingMatch) {
      currentSection = Number(headingMatch[1]);
      continue;
    }
    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (currentSection === 2) {
      const m = line.match(PALETTE_BULLET_PATTERN);
      if (m) {
        const role = m[1].trim();
        const value = m[2].trim();
        recordColorToken(value, role, hexes, rgbValues, roleByValue);
      }
    } else if (currentSection === 3 && inCodeBlock) {
      const fm = line.match(FONT_FAMILY_LINE_PATTERN);
      if (fm) {
        const stack = fm[1].trim();
        recordFontStack(stack, fonts);
      }
    } else if (currentSection === 5) {
      const trimmed = line.trim();
      const radiusMatch = trimmed.match(RADIUS_TABLE_ROW_PATTERN);
      if (radiusMatch) {
        radii.add(normalizeRadius(radiusMatch[1].trim()));
      }
      if (inCodeBlock) {
        const sm = trimmed.match(SHADOW_LINE_PATTERN);
        if (sm) {
          shadows.add(normalizeShadow(sm[1]));
        }
      }
    }
  }

  const result: ProjectTokenIndex = {
    hexes,
    rgbValues,
    fonts,
    radii,
    shadows,
    roleByValue,
    hash,
  };
  cache.set(hash, result);
  return result;
}

function recordColorToken(
  rawValue: string,
  role: string,
  hexes: Set<string>,
  rgbValues: Set<string>,
  roleByValue: Map<string, string[]>,
): void {
  const value = rawValue.trim();
  const normalized = normalizeColorValue(value);
  if (!normalized) return;
  if (normalized.kind === "hex") {
    hexes.add(normalized.value);
    appendRole(roleByValue, normalized.value, role);
  } else {
    rgbValues.add(normalized.value);
    appendRole(roleByValue, normalized.value, role);
  }
}

function recordFontStack(stack: string, fonts: Set<string>): void {
  for (const part of stack.split(",")) {
    const cleaned = part.trim().replace(/^["']|["']$/g, "").toLowerCase();
    if (!cleaned) continue;
    if (NEUTRAL_FONT_TOKENS.has(cleaned)) continue;
    fonts.add(cleaned);
  }
}

export function normalizeColorValue(
  raw: string,
):
  | { kind: "hex"; value: string }
  | { kind: "rgb"; value: string }
  | null {
  const trimmed = raw.trim();
  if (/^#([0-9a-fA-F]{3,8})$/.test(trimmed)) {
    return { kind: "hex", value: trimmed.toUpperCase() };
  }
  const rgbMatch = trimmed.match(/^rgba?\s*\(\s*([^)]+)\s*\)$/i);
  if (rgbMatch) {
    const compact = rgbMatch[0]
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/^rgba/, "rgba")
      .replace(/^rgb/, "rgb");
    return { kind: "rgb", value: compact };
  }
  const hslMatch = trimmed.match(/^hsla?\s*\([^)]+\)$/i);
  if (hslMatch) {
    return {
      kind: "rgb",
      value: trimmed.toLowerCase().replace(/\s+/g, ""),
    };
  }
  return null;
}

export function normalizeRadius(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

export function normalizeShadow(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function appendRole(
  index: Map<string, string[]>,
  value: string,
  role: string,
): void {
  const existing = index.get(value);
  if (existing) {
    if (!existing.includes(role)) existing.push(role);
    return;
  }
  index.set(value, [role]);
}

export function clearProjectTokenIndexCache(): void {
  cache.clear();
}
