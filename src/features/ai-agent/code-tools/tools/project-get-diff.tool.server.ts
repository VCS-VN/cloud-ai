import type { CodeToolDefinition } from "../code-agent-types";
import { toolSuccess } from "../code-tool-executor.server";
import { ProjectPatchService } from "../services/project-patch-service.server";

export function createProjectGetDiffTool(service = new ProjectPatchService()): CodeToolDefinition<{ includePatch?: boolean; maxBytes?: number }> {
  return {
    name: "project_get_diff",
    category: "inspect",
    description: "Return a bounded summary of files changed during the current run.",
    strict: true,
    parametersJsonSchema: { type: "object", properties: { includePatch: { type: "boolean" }, maxBytes: { type: "number" } }, required: ["includePatch", "maxBytes"], additionalProperties: false },
    handler: async ({ context, args }) => {
      const startedAt = Date.now();
      const records = (context as unknown as {
        __codeToolMutationRecords?: Array<{
          path: string;
          operation: "created" | "modified" | "deleted";
          beforeBytes: number;
          afterBytes: number;
        }>;
      }).__codeToolMutationRecords;
      const data = records?.length
        ? buildMutationDiff(records, args.includePatch, args.maxBytes)
        : await service.getDiff({ workspaceRoot: context.workspaceRoot, includePatch: args.includePatch, maxBytes: args.maxBytes });
      return toolSuccess({ context, toolName: "project_get_diff", category: "inspect", startedAt, data });
    },
  };
}

function buildMutationDiff(
  records: Array<{
    path: string;
    operation: "created" | "modified" | "deleted";
    beforeBytes: number;
    afterBytes: number;
  }>,
  includePatch?: boolean,
  maxBytes = 20_000,
) {
  const changedFiles = Array.from(new Set(records.map((record) => record.path)));
  if (!includePatch) return { changedFiles, patch: undefined, truncated: false };

  const patch = records
    .map((record) => [
      `diff -- ${record.path}`,
      `operation: ${record.operation}`,
      `bytes: ${record.beforeBytes} -> ${record.afterBytes}`,
    ].join("\n"))
    .join("\n");

  if (Buffer.byteLength(patch, "utf8") > maxBytes) {
    return { changedFiles, patch: patch.slice(0, maxBytes), truncated: true };
  }

  return { changedFiles, patch, truncated: false };
}
