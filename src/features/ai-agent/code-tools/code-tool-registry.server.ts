import type { CodeToolDefinition, CodeToolPhase } from "./code-agent-types";
import { createProjectApplyPatchTool } from "./tools/project-apply-patch.tool.server";
import { createProjectCreateFileTool } from "./tools/project-create-file.tool.server";
import { createProjectCreateSnapshotTool } from "./tools/project-create-snapshot.tool.server";
import { createProjectGetDiffTool } from "./tools/project-get-diff.tool.server";
import { createProjectRollbackSnapshotTool } from "./tools/project-rollback-snapshot.tool.server";
import { createProjectRunValidationTool } from "./tools/project-run-validation.tool.server";
import { projectGetContextTool } from "./tools/project-get-context.tool.server";
import { projectGetFileTreeTool } from "./tools/project-get-file-tree.tool.server";
import { projectReadFileRangeTool } from "./tools/project-read-file-range.tool.server";
import { projectReadFileTool } from "./tools/project-read-file.tool.server";
import { projectSearchCodeTool } from "./tools/project-search-code.tool.server";

export const CODE_TOOL_LIMITS = {
  maxToolLoopIterations: 40,
  maxMutationToolsPerMessage: 8,
  maxValidationAttempts: 3,
  maxRepairAttempts: 2,
  maxFilesChangedWithoutReview: 12,
  maxPatchBytes: 300_000,
  maxToolOutputBytes: 120_000,
} as const;

const PHASE_TOOL_NAMES: Record<CodeToolPhase, string[]> = {
  bootstrap: [
    "project_get_context",
    "project_get_file_tree",
    "project_search_code",
    "project_read_file",
    "project_read_file_range",
  ],
  planning: [
    "project_get_context",
    "project_get_file_tree",
    "project_search_code",
    "project_read_file",
    "project_read_file_range",
  ],
  mutation: [
    "project_get_context",
    "project_get_file_tree",
    "project_search_code",
    "project_read_file",
    "project_read_file_range",
    "project_create_snapshot",
    "project_apply_patch",
    "project_create_file",
    "project_get_diff",
  ],
  validation: [
    "project_run_validation",
    "project_get_diff",
    "project_read_file",
    "project_read_file_range",
    "project_search_code",
  ],
  repair: [
    "project_search_code",
    "project_read_file",
    "project_read_file_range",
    "project_apply_patch",
    "project_run_validation",
    "project_get_diff",
    "project_rollback_snapshot",
  ],
};

export class CodeToolRegistry {
  private readonly tools = new Map<string, CodeToolDefinition<any, any>>();

  register<TArgs, TData>(tool: CodeToolDefinition<TArgs, TData>) {
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string) {
    return this.tools.get(name);
  }

  list() {
    return Array.from(this.tools.values());
  }

  listForPhase(phase: CodeToolPhase) {
    const allowed = new Set(PHASE_TOOL_NAMES[phase]);
    return this.list().filter((tool) => allowed.has(tool.name));
  }
}

export function registerMutationAndSnapshotTools(registry: CodeToolRegistry) {
  return registry
    .register(createProjectCreateSnapshotTool())
    .register(createProjectRollbackSnapshotTool())
    .register(createProjectApplyPatchTool())
    .register(createProjectCreateFileTool())
    .register(createProjectGetDiffTool())
    .register(createProjectRunValidationTool());
}

export function createDefaultCodeToolRegistry() {
  return registerMutationAndSnapshotTools(new CodeToolRegistry()
    .register(projectGetContextTool)
    .register(projectGetFileTreeTool)
    .register(projectSearchCodeTool)
    .register(projectReadFileTool)
    .register(projectReadFileRangeTool));
}

export function selectAllowedToolNames(input: {
  inspectionCompleted: boolean;
  mutationCompleted: boolean;
  repairMode?: boolean;
}) {
  if (!input.inspectionCompleted) return PHASE_TOOL_NAMES.bootstrap;
  if (input.repairMode) return PHASE_TOOL_NAMES.repair;
  if (!input.mutationCompleted) return PHASE_TOOL_NAMES.mutation;
  return PHASE_TOOL_NAMES.validation;
}

export function buildOpenAIFunctionTools(tools: CodeToolDefinition[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    name: tool.name,
    description: tool.description,
    strict: tool.strict,
    parameters: tool.parametersJsonSchema,
  }));
}
