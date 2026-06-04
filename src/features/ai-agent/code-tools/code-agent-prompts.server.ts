import { buildStoreRuntimeInstructions, buildStoreRuntimePromptContext } from "../store-runtime/store-runtime-prompt";
import type { ProjectState } from "../project/project-state.schema";
import { loadPromptDoc } from "../agent/prompt-template-store.server";
import { isProtectedProjectEnvPath } from "./services/project-path-guard.server";

export const CODE_AGENT_DEVELOPER_PROMPT = loadPromptDoc("templates/code-agent/developer.md");

export type CodeAgentTaskSummary = {
  title: string;
  userPrompt: string;
  goal: string;
  riskLevel?: "low" | "medium" | "high";
};

export function summarizeProjectStateForCodeAgent(projectState: ProjectState) {
  return {
    projectId: projectState.projectId,
    status: projectState.status,
    stack: projectState.stack,
    features: projectState.features,
    constraints: projectState.constraints,
    recentChanges: projectState.recentChanges.slice(-5),
    fileManifest: projectState.fileManifest
      .filter((file) => !isProtectedProjectEnvPath(file.path))
      .map((file) => ({
        path: file.path,
        kind: file.kind,
        purpose: file.purpose,
        symbols: file.symbols,
      })),
  };
}

export function buildInitialCodeAgentInput(input: {
  agentTask: CodeAgentTaskSummary;
  projectState: ProjectState;
  selectedStoreSlug?: string | null;
}) {
  return [
    { role: "developer" as const, content: CODE_AGENT_DEVELOPER_PROMPT },
    {
      role: "user" as const,
      content: JSON.stringify({
        agentTask: input.agentTask,
        projectStateSummary: summarizeProjectStateForCodeAgent(input.projectState),
        storeRuntimeContext: buildStoreRuntimePromptContext({
          selectedStoreSlug: input.selectedStoreSlug,
        }),
        storeRuntimeInstructions: buildStoreRuntimeInstructions({
          selectedStoreSlug: input.selectedStoreSlug,
          mode: "edit",
        }),
        instruction: "Inspect the project with tools before applying any code change. Minimum sequence: project_get_context, project_get_file_tree, then project_search_code or project_read_file for relevant files before project_apply_patch or project_create_file. Do not patch blindly.",
      }),
    },
  ];
}
