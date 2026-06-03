import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import type { CodeToolDefinition } from "../code-agent-types";
import { toolError, toolSuccess } from "../code-tool-executor.server";
import { guardProjectPath, isForbiddenProjectPath } from "../services/project-path-guard.server";

/** @deprecated Use globTool instead. Remove after 2026-07-01. */
export const projectGetFileTreeTool: CodeToolDefinition<{ root?: string; maxDepth?: number }> = {
  name: "project_get_file_tree",
  category: "inspect",
  description: "List a safe project-relative file tree excluding secrets, dependencies, caches, and build output.",
  strict: true,
  parametersJsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      root: { type: "string" },
      maxDepth: { type: "number", minimum: 1, maximum: 8 },
    },
  },
  handler: async ({ context, args }) => {
    const startedAt = Date.now();
    const guarded = guardProjectPath({ workspaceRoot: context.workspaceRoot, path: args.root ?? "" });
    if (!guarded.ok) return toolError(context, "project_get_file_tree", "inspect", startedAt, guarded.code, guarded.message, true);

    const entries = await collectTree(context.workspaceRoot, guarded.relativePath, args.maxDepth ?? 4, 0);
    return toolSuccess({ context, toolName: "project_get_file_tree", category: "inspect", startedAt, data: { root: guarded.relativePath, entries } });
  },
};

async function collectTree(workspaceRoot: string, root: string, maxDepth: number, depth: number): Promise<Array<{ path: string; type: "file" | "directory" }>> {
  if (depth >= maxDepth) return [];
  const absoluteRoot = join(workspaceRoot, root);
  const dirEntries = await readdir(absoluteRoot, { withFileTypes: true });
  const result: Array<{ path: string; type: "file" | "directory" }> = [];

  for (const entry of dirEntries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = relative(workspaceRoot, join(absoluteRoot, entry.name)).replaceAll("\\", "/");
    if (isForbiddenProjectPath(entryPath)) continue;
    if (entry.isDirectory()) {
      result.push({ path: entryPath, type: "directory" });
      result.push(...(await collectTree(workspaceRoot, entryPath, maxDepth, depth + 1)));
    } else if (entry.isFile()) {
      result.push({ path: entryPath, type: "file" });
    }
  }

  return result;
}
