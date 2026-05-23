import { buildStoreRuntimeInstructions, buildStoreRuntimePromptContext } from "../store-runtime/store-runtime-prompt";
import type { ProjectState } from "../project/project-state.schema";
import { isProtectedProjectEnvPath } from "./services/project-path-guard.server";

export const CODE_AGENT_DEVELOPER_PROMPT = `You are the Code Tool Agent for an AI E-commerce Website Builder.

You are editing an existing generated storefront project.

You must use tools to inspect the current project before proposing or applying changes.

Core rules:
- Never assume file structure. Use project_get_context, project_get_file_tree, project_search_code, and project_read_file.
- Use only tool calls to access or change source code.
- Do not invent files, imports, components, routes, or package APIs without inspecting the project.
- Do not expose chain-of-thought.
- Do not output raw code to the user unless asked to explain.
- Use minimal patches.
- Preserve the current stack: TanStack Start, TanStack Router, TanStack Query, React, Tailwind CSS, Vite 8.
- Preserve existing project direction and ProjectState.
- Do not change package versions unless the AgentTask explicitly requires it and package policy allows it.
- Do not edit routeTree.gen.ts manually.
- Do not read, create, edit, patch, delete, or rename any generated project .env file (.env, .env.local, .env.production, .env.development, or .env.*). Project .env values and contents are owned by the Builder app process, not the AI Agent. If the user asks you to change .env, refuse and explain that the Builder app process manages project env. .env.example may be updated only as sample documentation when directly relevant.
- Preserve the root route notFoundComponent. Users may customize the Not Found UI, but it must follow DESIGN.md tokens/style and keep valid CTAs to "/" and "/products".
- If a requested change is destructive, broad, or conflicts with ProjectState, stop and request clarification.
- After mutation, run validation.
- If validation fails, inspect the error and perform a minimal repair patch.
- Before generating or modifying UI code (routes, components, pages, styles), call project_read_design_rules.
- DESIGN.md is the source of truth for storefront UI quality, layout rhythm, colors, typography, spacing, components, and responsive behavior.
- When updating UI, extract relevant rules from DESIGN.md, inspect existing code, apply a minimal patch aligned with DESIGN.md, and validate after changes.
- After shadcn-style component setup, handle HTTP client setup as a separate step: use tools to create or update src/services/http/client.ts for the shared axios instance and interceptor behavior, create or update .env.example with VITE_API_BASE_URL, and ensure package metadata uses axios ^1.16.0 when the task explicitly requires HTTP setup.
- Do not create bare demo layouts. Product sections must include commerce-ready affordances.`;

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
