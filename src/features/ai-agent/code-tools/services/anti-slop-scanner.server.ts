import { parseDesignTokenBlock } from "./design-file-validator.server";
import { readTokenValue, readTokenValueDark } from "./design-token-schema.server";

export type AntiSlopViolation = {
  code: string;
  message: string;
  /** First matched snippet, for surfacing to the user. */
  sample: string;
};

export type AntiSlopScanResult = {
  ok: boolean;
  violations: AntiSlopViolation[];
};

// Raw Tailwind color families that signal off-palette / slop when used directly in
// customer-facing storefront code. The approved path is semantic role utilities
// (bg-primary, text-accent, bg-deep, etc.) driven by DESIGN.md tokens.
const RAW_TAILWIND_COLOR_FAMILIES = [
  "slate", "gray", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
];

// Utility prefixes that take a color (bg-, text-, border-, from-, to-, via-, ring-, fill-, stroke-).
const COLOR_UTILITY_PREFIXES = ["bg", "text", "border", "from", "to", "via", "ring", "fill", "stroke"];

const RAW_COLOR_REGEX = new RegExp(
  `\\b(?:${COLOR_UTILITY_PREFIXES.join("|")})-(?:${RAW_TAILWIND_COLOR_FAMILIES.join("|")})-\\d{2,3}\\b`,
  "g",
);

// AI-purple / mesh hero signature: purple/violet/indigo/fuchsia gradients.
const AI_PURPLE_GRADIENT_REGEX =
  /(?:from|via|to)-(?:purple|violet|indigo|fuchsia)-\d{2,3}/i;

// Section-numbering eyebrow: "001 ·", "01 /", "001 -" used as decorative label.
const NUMBERED_EYEBROW_REGEX = /['">]\s*0\d{1,2}\s*[·/\-—]/;

// Decorative version label: v1.0, v2, V3.1 as standalone decoration in JSX text.
const VERSION_LABEL_REGEX = /['">]\s*[vV]\d+(?:\.\d+)?\s*['"<]/;

/**
 * Allow brand colors that legitimately match a declared palette token, even if a
 * developer hard-codes the hex. We compare lowercased hex strings.
 */
function collectAllowedHexValues(designMarkdown: string | undefined): Set<string> {
  const allowed = new Set<string>();
  if (!designMarkdown) return allowed;
  const block = parseDesignTokenBlock(designMarkdown);
  const colors = block?.tokens?.colors;
  if (!colors) return allowed;
  for (const entry of Object.values(colors)) {
    const light = readTokenValue(entry);
    const dark = readTokenValueDark(entry);
    if (light) allowed.add(light.toLowerCase());
    if (dark) allowed.add(dark.toLowerCase());
  }
  return allowed;
}

/**
 * Scan generated storefront source for anti-slop violations. Distilled from the
 * taste-skill bans, adapted for commerce. Color violations cross-reference DESIGN.md
 * tokens so a legitimate brand color is not flagged.
 *
 * All violations are hard (caller decides repair vs surface). Returns ok=true when clean.
 */
export function scanForAntiSlop(input: {
  source: string;
  designMarkdown?: string;
}): AntiSlopScanResult {
  const violations: AntiSlopViolation[] = [];
  const { source } = input;

  // 1. Off-palette raw Tailwind color utilities (Color Consistency Lock).
  const rawMatches = source.match(RAW_COLOR_REGEX);
  if (rawMatches && rawMatches.length > 0) {
    const unique = Array.from(new Set(rawMatches));
    violations.push({
      code: "ANTI_SLOP_OFF_PALETTE_COLOR",
      message: `Off-palette raw Tailwind color utilities found (${unique
        .slice(0, 6)
        .join(", ")}). Use declared DESIGN.md palette roles (primary/accent/highlight/deep + surface/foreground/semantic) instead.`,
      sample: unique[0],
    });
  }

  // 2. AI-purple / mesh-hero gradient.
  const purple = source.match(AI_PURPLE_GRADIENT_REGEX);
  if (purple) {
    violations.push({
      code: "ANTI_SLOP_AI_PURPLE_GRADIENT",
      message:
        "AI-purple/violet gradient detected. Do not default to purple/violet/indigo gradient washes or a centered hero over a dark mesh gradient; use palette roles.",
      sample: purple[0],
    });
  }

  // 3. Section-numbering eyebrow.
  const eyebrow = source.match(NUMBERED_EYEBROW_REGEX);
  if (eyebrow) {
    violations.push({
      code: "ANTI_SLOP_NUMBERED_EYEBROW",
      message:
        "Section-numbering eyebrow (e.g. '001 · …') detected. Eyebrows must carry real retail meaning, not decorative numbering.",
      sample: eyebrow[0].trim(),
    });
  }

  // 4. Decorative version label.
  const version = source.match(VERSION_LABEL_REGEX);
  if (version) {
    violations.push({
      code: "ANTI_SLOP_VERSION_LABEL",
      message: "Decorative version label (e.g. 'v2.0') detected. Remove decorative version chrome.",
      sample: version[0].trim(),
    });
  }

  return { ok: violations.length === 0, violations };
}
