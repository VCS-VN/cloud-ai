import type { ToolHook } from "./hook-types";
import { scanForAntiSlop } from "../services/anti-slop-scanner.server";
import { isStorefrontUiPath } from "../services/project-path-guard.server";

export function createPostWriteHooks(): ToolHook[] {
  return [antiSlopHook];
}

const antiSlopHook: ToolHook = {
  type: "post_write",
  applicable: () => true,
  handler: async ({ context, args, tool }) => {
    const changedFiles = extractPotentialChangedFiles(args);
    const uiFiles = changedFiles.filter((file) => isUiRelatedFilePath(file));
    if (uiFiles.length === 0) return { ok: true };

    const warnings: string[] = [];
    for (const path of uiFiles) {
      try {
        const source = await (context as any).fileStore?.readTextFile?.(context.projectId, path);
        if (typeof source !== "string") continue;
        const scan = scanForAntiSlop({ source, designMarkdown: undefined });
        for (const violation of scan.violations) warnings.push(`${path}: ${violation.message}`);
      } catch {
        continue;
      }
    }
    return warnings.length ? { ok: true, warnings } : { ok: true };
  },
};

function extractPotentialChangedFiles(args: unknown) {
  if (!args || typeof args !== "object") return [];
  const record = args as Record<string, unknown>;
  if (Array.isArray(record.expectedChangedFiles)) return record.expectedChangedFiles.filter((v): v is string => typeof v === "string");
  if (typeof record.path === "string") return [record.path];
  return [];
}

function isUiRelatedFilePath(filePath: string): boolean {
  return isStorefrontUiPath(filePath) || filePath.startsWith("public/");
}
