import { buildStoreRuntimeInstructions, buildStoreRuntimePromptContext } from "../store-runtime/store-runtime-prompt";
import type { AgenticLoopInput } from "./agentic-loop.types";
import type { ProjectState } from "../project/project-state.schema";
import { isProtectedProjectEnvPath } from "../code-tools/services/project-path-guard.server";
import { loadProjectRuleDocsForPrompt } from "./project-rule-docs.server";
import { renderPromptDoc } from "./prompt-template-store.server";

const AGENT_SYSTEM_EDIT_PROMPT = "templates/agent-system/edit-system.md";
const AGENT_SYSTEM_RETAIL_CONSTRAINTS_PROMPT = "templates/agent-system/retail-constraints.md";
const AGENT_SYSTEM_REASONING_WORKFLOW_PROMPT = "templates/agent-system/reasoning-workflow.md";
const AGENT_SYSTEM_INIT_MODE_PROMPT = "templates/agent-system/init-mode.md";

export function buildAgenticSystemPrompt(input: AgenticLoopInput): string {
  const projectRuleDocs = loadProjectRuleDocsForPrompt();
  return [
    renderPromptDoc(AGENT_SYSTEM_EDIT_PROMPT, {}),
    renderPromptDoc(AGENT_SYSTEM_RETAIL_CONSTRAINTS_PROMPT, {
      projectRuleDocs: projectRuleDocs || "(No project rule docs were loaded.)",
    }),
    renderPromptDoc(AGENT_SYSTEM_REASONING_WORKFLOW_PROMPT, {}),
    renderPromptDoc(AGENT_SYSTEM_INIT_MODE_PROMPT, {}),
    buildProjectStateSummary(input.projectState).trimStart(),
    buildStoreRuntimeInstructions({
      selectedStoreSlug: input.selectedStoreSlug,
      mode: input.projectState.status === "empty" || input.projectState.status === "initializing" ? "init" : "edit",
    }),
  ].join("\n\n");
}

export function buildUserMessageWithThinking(input: AgenticLoopInput): string {
  const t = input.thinkingResult;
  return JSON.stringify({
    userRequest: input.userPrompt,
    understanding: t.userFacingUnderstanding,
    intent: t.promptClassification.lifecycleIntent,
    riskLevel: t.riskAssessment.level,
    normalizedGoal: t.downstreamTask.normalizedGoal,
    acceptanceCriteria: t.suggestedAcceptanceCriteria,
    constraints: t.constraints,
    storeRuntimeContext: buildStoreRuntimePromptContext({
      selectedStoreSlug: input.selectedStoreSlug,
    }),
    affectedPages: t.ecommerceInterpretation.affectedPages,
    affectedFeatures: t.ecommerceInterpretation.affectedFeatures,
  });
}

function buildProjectStateSummary(ps: ProjectState): string {
  const activeFeatures = Object.entries(ps.features)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(", ");

  return [
    `\nPROJECT STATE:`,
    `- Status: ${ps.status}`,
    `- Stack: ${ps.stack.framework}, ${ps.stack.router}, ${ps.stack.ui}, ${ps.stack.styling}, ${ps.stack.bundler} ${ps.stack.viteVersion}`,
    `- Brand: ${ps.brand.name} (${ps.brand.tone})`,
    `- Pages: ${ps.pages.map((p) => p.path).join(", ") || "none"}`,
    `- Files: ${ps.fileManifest.filter((file) => !isProtectedProjectEnvPath(file.path)).length} in manifest`,
    `- Recent changes: ${ps.recentChanges.length}`,
    `- Features: ${activeFeatures || "none"}`,
  ].join("\n");
}
