import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import type { TokenHint, TokenHintRole } from "../../planning/design-intent-heuristic";
import { validateVisualMarkdown } from "./design-generation-service.server";
import { DESIGN_ERROR_CODES, type DesignErrorCode } from "./design-error-codes";

export type TokenPatchInput = {
  projectId: string;
  workspaceRoot: string;
  tokenHints: ReadonlyArray<TokenHint>;
};

export type TokenPatchSuccess = {
  ok: true;
  destinationPath: "DESIGN.md";
  previousHash: string;
  hash: string;
  byteSize: number;
  appliedRoles: string[];
};

export type TokenPatchFailure = {
  ok: false;
  code: DesignErrorCode;
  message: string;
  details?: unknown;
};

export type TokenPatchResult = TokenPatchSuccess | TokenPatchFailure;

const ROLE_HUMAN_NAMES: Record<TokenHintRole, string[]> = {
  primaryBrand: ["Primary Brand"],
  accentBrand: ["Accent Brand"],
  deepSurface: ["Deep Brand", "Deep Surface", "Dark Surface"],
  pageCanvas: ["Page Canvas", "Warm Page Canvas"],
  cardSurface: ["Card Surface", "White"],
  sectionSurface: ["Section Surface", "Ceramic Surface", "Quiet Surface"],
  textOnLight: ["Text On Light", "Text Primary"],
  textOnLightMuted: [
    "Text On Light Muted",
    "Text Secondary",
    "Text Primary Muted",
  ],
  textOnDark: ["Text On Dark"],
  textOnDarkMuted: ["Text On Dark Muted", "Text On Dark Secondary"],
  error: ["Error"],
  warning: ["Warning"],
  success: ["Success", "Success Tint"],
  fontFamilyPrimary: ["Font Family"],
  radiusInput: [],
  radiusCard: [],
  radiusPill: [],
  shadowCard: [],
  shadowNav: [],
  shadowFloating: [],
};

export async function applyTokenPatches(
  input: TokenPatchInput,
): Promise<TokenPatchResult> {
  if (!input.tokenHints || input.tokenHints.length === 0) {
    return failure(
      DESIGN_ERROR_CODES.DESIGN_PATCH_AMBIGUOUS_TOKEN_REQUEST,
      "No concrete token values provided. Ask the user to specify a value (e.g. a hex code or a quoted font name).",
    );
  }

  const designPath = resolve(input.workspaceRoot, "DESIGN.md");
  let original: string;
  try {
    original = await readFile(designPath, "utf-8");
  } catch {
    return failure(
      DESIGN_ERROR_CODES.DESIGN_FILE_MISSING,
      "DESIGN.md is missing in the project workspace. Generate it via init/redesign before patching tokens.",
    );
  }

  const previousHash = hash(original);
  let working = original;
  const appliedRoles: string[] = [];
  const missingRoles: string[] = [];

  for (const hint of input.tokenHints) {
    if (!hint.role) {
      missingRoles.push("<unknown>");
      continue;
    }
    const supportedHumanNames = ROLE_HUMAN_NAMES[hint.role];
    if (!supportedHumanNames || supportedHumanNames.length === 0) {
      missingRoles.push(hint.role);
      continue;
    }
    const replaced = replaceRoleValue(working, supportedHumanNames, hint);
    if (!replaced) {
      missingRoles.push(hint.role);
      continue;
    }
    working = replaced;
    appliedRoles.push(hint.role);
  }

  if (missingRoles.length > 0) {
    return failure(
      DESIGN_ERROR_CODES.DESIGN_PATCH_TOKEN_ROLE_NOT_FOUND,
      `Could not find these roles in DESIGN.md: ${missingRoles.join(", ")}. Use a redesign prompt if these roles need to be added to the design system.`,
      { missingRoles },
    );
  }

  const structural = validateVisualMarkdown(working);
  if (!structural.ok) {
    return failure(
      DESIGN_ERROR_CODES.DESIGN_PATCH_STRUCTURE_BROKEN,
      `Structural validation failed after patching tokens. Missing sections: ${structural.missingSections.join(", ")}.`,
    );
  }

  if (working === original) {
    return {
      ok: true,
      destinationPath: "DESIGN.md",
      previousHash,
      hash: previousHash,
      byteSize: Buffer.byteLength(original, "utf-8"),
      appliedRoles,
    };
  }

  await writeFile(designPath, working, "utf-8");

  return {
    ok: true,
    destinationPath: "DESIGN.md",
    previousHash,
    hash: hash(working),
    byteSize: Buffer.byteLength(working, "utf-8"),
    appliedRoles,
  };
}

function replaceRoleValue(
  markdown: string,
  humanNames: ReadonlyArray<string>,
  hint: TokenHint,
): string | null {
  if (hint.role === "fontFamilyPrimary") {
    return replaceFontFamily(markdown, hint.value);
  }
  for (const human of humanNames) {
    const escaped = escapeRegex(human);
    const pattern = new RegExp(
      `(- \\*\\*${escaped}\\*\\*\\s*\\(\`)([^\`]+)(\`\\):)`,
      "i",
    );
    if (pattern.test(markdown)) {
      return markdown.replace(pattern, `$1${hint.value}$3`);
    }
  }
  return null;
}

function replaceFontFamily(markdown: string, value: string): string | null {
  const codeBlockRegex = /(```css[\s\S]*?font-family:\s*)([^;\n]+)(;[\s\S]*?```)/i;
  if (codeBlockRegex.test(markdown)) {
    return markdown.replace(codeBlockRegex, (_match, before, _existing, after) => {
      return `${before}${value}${after}`;
    });
  }
  const inlineRegex = /(font-family:\s*)([^;\n]+)(;)/i;
  if (inlineRegex.test(markdown)) {
    return markdown.replace(inlineRegex, `$1${value}$3`);
  }
  return null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function failure(
  code: DesignErrorCode,
  message: string,
  details?: unknown,
): TokenPatchFailure {
  return { ok: false, code, message, details };
}
