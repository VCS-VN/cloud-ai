import type { AgenticLoopResult } from "../agent/agentic-loop.types";

/** Paths that must not be filled by deterministic initSource (generic template UI). */
const INIT_UI_BACKFILL_EXACT = new Set(["DESIGN.md", "src/styles/app.css"]);

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
    if (isInitUiStorefrontPath(file.path)) return false;
    return true;
  });
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
