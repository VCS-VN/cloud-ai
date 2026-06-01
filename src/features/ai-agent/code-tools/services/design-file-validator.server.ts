import { contrastRatioForHex, parseHexColor } from "./design-color-contrast.server";
import {
  hasManagedDesignNotice,
  REQUIRED_DESIGN_SECTIONS,
} from "./design-file-contract.server";
import {
  PHASE1_COLOR_TOKEN_KEYS,
  PHASE1_TOKEN_GROUP_KEYS,
  readTokenValue,
  readTokenValueDark,
  DESIGN_DIAL_BOUNDS,
  DESIGN_DIAL_KEYS,
  type DesignTokenBlock,
} from "./design-token-schema.server";

export type DesignFileViolation = {
  code: string;
  message: string;
  path?: string;
};

export type DesignFileValidationResult =
  | { ok: true; warnings: DesignFileViolation[]; tokenBlock: DesignTokenBlock }
  | { ok: false; violations: DesignFileViolation[]; warnings: DesignFileViolation[] };

const REQUIRED_INTENT_FIELDS = [
  "category",
  "audience",
  "priceTier",
  "archetype",
  "mood",
  "seed",
  "source",
];

const REQUIRED_CONTRAST_PAIRS: Array<[string, string]> = [
  ["primary-foreground", "primary"],
  ["accent-foreground", "accent"],
  ["highlight-foreground", "highlight"],
  ["foreground", "background"],
  ["foreground", "surface"],
  ["foreground", "surface-muted"],
];

export function validateManagedDesignFile(markdown: string): DesignFileValidationResult {
  const violations: DesignFileViolation[] = [];
  const warnings: DesignFileViolation[] = [];

  if (!hasManagedDesignNotice(markdown)) {
    violations.push({
      code: "MANAGED_NOTICE_MISSING",
      message: "DESIGN.md must include managed generated-file notices.",
    });
  }

  for (const section of REQUIRED_DESIGN_SECTIONS) {
    const pattern = new RegExp(`^##\\s+${section.index}\\.\\s+${escapeRegExp(section.heading)}\\s*$`, "m");
    if (!pattern.test(markdown)) {
      violations.push({
        code: "DESIGN_SECTION_MISSING",
        message: `DESIGN.md must include section ${section.index}. ${section.heading}.`,
      });
    }
  }

  const tokenBlock = parseDesignTokenBlock(markdown);
  if (!tokenBlock) {
    violations.push({
      code: "DESIGN_TOKEN_BLOCK_INVALID",
      message: "DESIGN.md must contain a parseable YAML-like token block with designIntent and tokens.",
    });
    return { ok: false, violations, warnings };
  }

  validateIntent(tokenBlock, violations);
  validateDials(tokenBlock, violations);
  validateTokenGroups(tokenBlock, violations);
  validateColorTokens(tokenBlock, violations, warnings);

  if (violations.length > 0) return { ok: false, violations, warnings };
  return { ok: true, warnings, tokenBlock };
}

export function parseDesignTokenBlock(markdown: string): DesignTokenBlock | null {
  const source = markdown.trimStart();
  const match = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;
  return parseSimpleYamlBlock(match[1]);
}

function validateIntent(block: DesignTokenBlock, violations: DesignFileViolation[]): void {
  const intent = block.designIntent;
  if (!intent || typeof intent !== "object") {
    violations.push({ code: "DESIGN_INTENT_MISSING", message: "designIntent is required." });
    return;
  }
  for (const field of REQUIRED_INTENT_FIELDS) {
    if (!(field in intent)) {
      violations.push({
        code: "DESIGN_INTENT_FIELD_MISSING",
        message: `designIntent.${field} is required.`,
        path: `designIntent.${field}`,
      });
    }
  }
}

function validateDials(block: DesignTokenBlock, violations: DesignFileViolation[]): void {
  const intent = block.designIntent;
  if (!intent || typeof intent !== "object") return;
  // Dials are optional (legacy DESIGN.md predates them). Only validate when present.
  for (const key of DESIGN_DIAL_KEYS) {
    if (!(key in intent)) continue;
    const raw = (intent as Record<string, unknown>)[key];
    const num = typeof raw === "number" ? raw : Number(raw);
    const { min, max } = DESIGN_DIAL_BOUNDS[key];
    if (!Number.isFinite(num) || num < min || num > max) {
      violations.push({
        code: "DESIGN_DIAL_OUT_OF_RANGE",
        message: `designIntent.${key} must be an integer in [${min}, ${max}] (commerce ceiling); got ${String(raw)}.`,
        path: `designIntent.${key}`,
      });
    }
  }
}

function validateTokenGroups(block: DesignTokenBlock, violations: DesignFileViolation[]): void {
  const tokens = block.tokens;
  if (!tokens || typeof tokens !== "object") {
    violations.push({ code: "DESIGN_TOKENS_MISSING", message: "tokens block is required." });
    return;
  }
  const allowedGroups = new Set<string>(PHASE1_TOKEN_GROUP_KEYS);
  for (const group of Object.keys(tokens)) {
    if (!allowedGroups.has(group)) {
      violations.push({
        code: "DESIGN_TOKEN_GROUP_EXTRA",
        message: `tokens.${group} is not allowed in Phase 1.`,
        path: `tokens.${group}`,
      });
    }
  }
  const colors = tokens.colors;
  if (!colors || typeof colors !== "object") {
    violations.push({ code: "DESIGN_COLOR_TOKENS_MISSING", message: "tokens.colors is required." });
    return;
  }
  const allowedColors = new Set<string>(PHASE1_COLOR_TOKEN_KEYS);
  for (const key of Object.keys(colors)) {
    if (!allowedColors.has(key)) {
      violations.push({
        code: "DESIGN_COLOR_TOKEN_EXTRA",
        message: `tokens.colors.${key} is not allowed in Phase 1.`,
        path: `tokens.colors.${key}`,
      });
    }
  }
  for (const key of PHASE1_COLOR_TOKEN_KEYS) {
    const value = readTokenValue(colors[key]);
    if (!value) {
      violations.push({
        code: "DESIGN_COLOR_TOKEN_VALUE_MISSING",
        message: `tokens.colors.${key}.value is required.`,
        path: `tokens.colors.${key}.value`,
      });
    }
  }
}

function validateColorTokens(
  block: DesignTokenBlock,
  violations: DesignFileViolation[],
  warnings: DesignFileViolation[],
): void {
  const colors = block.tokens?.colors;
  if (!colors) return;
  for (const key of PHASE1_COLOR_TOKEN_KEYS) {
    const value = readTokenValue(colors[key]);
    if (!value) continue;
    if (!parseHexColor(value)) {
      violations.push({
        code: "DESIGN_COLOR_VALUE_INVALID",
        message: `tokens.colors.${key}.value must be a valid hex color for Phase 1 validation.`,
        path: `tokens.colors.${key}.value`,
      });
    }
    const dark = readTokenValueDark(colors[key]);
    if (dark && !parseHexColor(dark)) {
      violations.push({
        code: "DESIGN_COLOR_VALUE_DARK_INVALID",
        message: `tokens.colors.${key}.valueDark must be a valid hex color when present.`,
        path: `tokens.colors.${key}.valueDark`,
      });
    }
  }
  for (const [foregroundKey, backgroundKey] of REQUIRED_CONTRAST_PAIRS) {
    const foreground = readTokenValue(colors[foregroundKey]);
    const background = readTokenValue(colors[backgroundKey]);
    if (!foreground || !background) continue;
    const ratio = contrastRatioForHex(foreground, background);
    if (ratio === null) continue;
    if (ratio < 4.5) {
      violations.push({
        code: "DESIGN_CONTRAST_FAILED",
        message: `${foregroundKey} on ${backgroundKey} must meet 4.5:1 contrast; got ${ratio.toFixed(2)}:1.`,
      });
    }
  }
  // Dark-mode contrast: only enforced when both tokens declare valueDark (dual-mode projects).
  for (const [foregroundKey, backgroundKey] of REQUIRED_CONTRAST_PAIRS) {
    const foreground = readTokenValueDark(colors[foregroundKey]);
    const background = readTokenValueDark(colors[backgroundKey]);
    if (!foreground || !background) continue;
    const ratio = contrastRatioForHex(foreground, background);
    if (ratio === null) continue;
    if (ratio < 4.5) {
      violations.push({
        code: "DESIGN_CONTRAST_DARK_FAILED",
        message: `${foregroundKey} on ${backgroundKey} (dark) must meet 4.5:1 contrast; got ${ratio.toFixed(2)}:1.`,
      });
    }
  }
  const muted = readTokenValue(colors["muted-foreground"]);
  const background = readTokenValue(colors.background);
  if (muted && background) {
    const ratio = contrastRatioForHex(muted, background);
    if (ratio !== null && ratio < 3) {
      warnings.push({
        code: "DESIGN_MUTED_CONTRAST_LOW",
        message: `muted-foreground on background should meet at least 3:1; got ${ratio.toFixed(2)}:1.`,
      });
    }
  }
}

function parseSimpleYamlBlock(source: string): DesignTokenBlock | null {
  const result: DesignTokenBlock = {};
  const lines = source.split(/\r?\n/);
  let section: "designIntent" | "tokens" | null = null;
  let tokenGroup: string | null = null;
  let tokenKey: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const indent = line.match(/^ */)?.[0].length ?? 0;
    const trimmed = line.trim();
    const pair = trimmed.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!pair) continue;
    const key = pair[1];
    const rawValue = pair[2] ?? "";
    const value = unquote(rawValue.trim());

    if (indent === 0) {
      if (key === "designIntent") {
        section = "designIntent";
        result.designIntent = {};
        tokenGroup = null;
        tokenKey = null;
      } else if (key === "tokens") {
        section = "tokens";
        result.tokens = {};
        tokenGroup = null;
        tokenKey = null;
      } else {
        section = null;
      }
      continue;
    }

    if (section === "designIntent") {
      if (indent === 2 && result.designIntent) {
        result.designIntent[key] = parseScalar(value);
      }
      continue;
    }

    if (section === "tokens") {
      if (indent === 2) {
        tokenGroup = key;
        tokenKey = null;
        result.tokens ??= {};
        result.tokens[tokenGroup] = {};
      } else if (indent === 4 && tokenGroup) {
        tokenKey = key;
        result.tokens ??= {};
        result.tokens[tokenGroup] ??= {};
        if (value) {
          result.tokens[tokenGroup][tokenKey] = value;
        } else {
          result.tokens[tokenGroup][tokenKey] = { value: "" };
        }
      } else if (indent === 6 && tokenGroup && tokenKey) {
        const entry = result.tokens?.[tokenGroup]?.[tokenKey];
        const objectEntry = typeof entry === "object" && entry ? entry : { value: typeof entry === "string" ? entry : "" };
        (objectEntry as Record<string, unknown>)[key] = parseScalar(value);
        result.tokens![tokenGroup][tokenKey] = objectEntry;
      }
    }
  }

  return result.designIntent || result.tokens ? result : null;
}

function parseScalar(value: string): unknown {
  if (value === "") return "";
  if (value.startsWith("[") && value.endsWith("]")) {
    return value.slice(1, -1).split(",").map((item) => unquote(item.trim())).filter(Boolean);
  }
  return value;
}

function unquote(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
