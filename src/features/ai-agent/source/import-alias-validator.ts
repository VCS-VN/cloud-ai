import type { FileOperation } from "../project/project-state.schema";
import type { GeneratedFile } from "./init-source.server";

export type ImportAliasViolation = {
  path: string;
  specifier: string;
  reason: "legacy_alias" | "relative_internal_import";
};

type SourceFile = Pick<GeneratedFile, "path" | "content">;

const sourceFilePattern = /^src\/.*\.(ts|tsx|css)$/;
const importSpecifierPatterns = [
  /(?:import|export)\s+(?:type\s+)?[^\n;]*?\s+from\s+["']([^"']+)["']/g,
  /import\s+["']([^"']+)["']/g,
  /import\s*\(\s*["']([^"']+)["']\s*\)/g,
  /@import\s+(?:url\()?\s*["']([^"']+)["']/g,
];

export function validateStorefrontImportAliases(
  entries: Array<SourceFile | FileOperation>,
): ImportAliasViolation[] {
  return entries.flatMap((entry) => {
    if (!hasContent(entry) || !sourceFilePattern.test(entry.path)) return [];

    const violations: ImportAliasViolation[] = [];
    for (const specifier of extractImportSpecifiers(entry.content)) {
      if (specifier.startsWith("~/")) {
        violations.push({ path: entry.path, specifier, reason: "legacy_alias" });
        continue;
      }
      if (specifier.startsWith(".") && !isAllowedRelativeImport(entry.path, specifier)) {
        violations.push({ path: entry.path, specifier, reason: "relative_internal_import" });
      }
    }
    return violations;
  });
}

export function assertStorefrontImportAliases(
  entries: Array<SourceFile | FileOperation>,
) {
  const violations = validateStorefrontImportAliases(entries);
  if (violations.length === 0) return;

  const summary = violations
    .slice(0, 5)
    .map((violation) => `${violation.path}: ${violation.specifier}`)
    .join("; ");
  console.warn(
    `[import-alias-validator] Project rule warning (non-blocking): prefer @/... for agent-authored internal imports. ${summary}`,
  );
}

function extractImportSpecifiers(content: string) {
  const specifiers: Array<{ specifier: string; index: number }> = [];
  for (const pattern of importSpecifierPatterns) {
    for (const match of content.matchAll(pattern)) {
      if (match[1]) specifiers.push({ specifier: match[1], index: match.index ?? 0 });
    }
  }
  return specifiers.sort((left, right) => left.index - right.index).map((item) => item.specifier);
}

function hasContent(entry: SourceFile | FileOperation): entry is SourceFile {
  return "content" in entry && typeof entry.content === "string";
}

function isAllowedRelativeImport(path: string, specifier: string) {
  return path === "src/router.tsx" && specifier === "./routeTree.gen";
}
