import type { AgenticLoopResult } from "../agent/agentic-loop.types";
import { REQUIRED_INIT_COMMERCE_ROUTE_FILES } from "./generated-project-layout";

/** Paths that must not be filled by deterministic initSource (generic template UI). */
const INIT_UI_BACKFILL_EXACT = new Set(["DESIGN.md", "src/styles/app.css"]);

/** Stable layout + commerce routes; safe to backfill even under UI prefixes. */
const INIT_DETERMINISTIC_BACKFILL_ALLOW = new Set([
  "src/components/layout/theme-toggle.tsx",
  "src/components/layout/site-footer.tsx",
  "src/components/layout/route-loading-bar.tsx",
  "src/components/store/not-found.tsx",
  "src/components/store/cart-drawer.tsx",
  ...REQUIRED_INIT_COMMERCE_ROUTE_FILES,
]);

const INIT_UI_BACKFILL_PREFIXES = [
  "src/components/layout/",
  "src/components/store/",
  "src/routes/",
] as const;

export function isInitUiStorefrontPath(filePath: string): boolean {
  if (INIT_UI_BACKFILL_EXACT.has(filePath)) return true;
  return INIT_UI_BACKFILL_PREFIXES.some(
    (prefix) => filePath === prefix || filePath.startsWith(prefix),
  );
}

/** Deterministic backfill must not mask a failed or aborted agentic loop. */
export function isDeterministicInitBackfillAllowed(
  loopResult: AgenticLoopResult,
): boolean {
  return loopResult.status !== "failed" && loopResult.status !== "aborted";
}

export function filterInitBackfillFiles<T extends { path: string }>(
  files: readonly T[],
  existingPaths: ReadonlySet<string>,
): T[] {
  return files.filter((file) => {
    if (existingPaths.has(file.path)) return false;
    if (INIT_DETERMINISTIC_BACKFILL_ALLOW.has(file.path)) return true;
    if (isInitUiStorefrontPath(file.path)) return false;
    return true;
  });
}

export function collectPresentInitPaths(
  pathsAtRunStart: ReadonlySet<string>,
  changedFiles: readonly string[],
): Set<string> {
  return new Set([...pathsAtRunStart, ...changedFiles]);
}

export function missingRequiredInitPaths(
  required: readonly string[],
  present: ReadonlySet<string>,
): string[] {
  return required.filter((path) => !present.has(path));
}

export function hasRequiredInitCommerceRoutes(present: ReadonlySet<string>): boolean {
  return REQUIRED_INIT_COMMERCE_ROUTE_FILES.every((path) => present.has(path));
}

/** True when the agent actually wrote routes/layout/store components (not just read DESIGN.md). */
export function isInitStorefrontImplementationPath(filePath: string): boolean {
  return (
    filePath.startsWith("src/routes/") ||
    filePath.startsWith("src/components/layout/") ||
    filePath.startsWith("src/components/store/")
  );
}

export function loopProducedInitUiFiles(changedFiles: readonly string[]): boolean {
  return changedFiles.some(isInitStorefrontImplementationPath);
}

export function initCommerceRoutesStillMissing(present: ReadonlySet<string>): boolean {
  return !hasRequiredInitCommerceRoutes(present);
}
