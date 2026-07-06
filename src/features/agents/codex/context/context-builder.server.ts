import {
  projectSummaryToContextBlock,
  type ProjectSummary,
} from "./project-summary.server";
import {
  wrapSelectedInstruction,
  type LoadedInstruction,
  type SelectedInstruction,
} from "./instruction-loader.server";
import {
  buildSelectedSkillBlocks,
  type SelectedSkillForInjection,
} from "@/features/agents/codex/skills/injection.server";
import type { LoadedSkill } from "@/features/agents/codex/skills/skill-loader.server";

export type ContextBundleInput = {
  projectId: string;
  userId: string | undefined;
  draftWorkspacePath: string;
  userPrompt: string;
  locale: string;
  projectSummary: ProjectSummary | null;
  fileManifest: string[];
  protectedPaths: { blocked: readonly string[]; allowedAudit: readonly string[] };
  validationRules: { typecheck: boolean; build: boolean; previewHealth: boolean };
  selectedInstructions: LoadedInstruction[];
  selectedSkills?: SelectedSkillForInjection[];
  skillRegistry?: LoadedSkill[];
  /**
   * Optional pre-computed scope from the thinking pass. When present, the agent
   * is told to focus on these files and skip broad discovery — avoiding a
   * redundant full-workspace re-exploration on every prompt.
   */
  scopeAnalysis?: { relevantFiles: string[]; approach: string } | null;
};

export type ContextBundleOutput = {
  prompt: string;
  selectedInstructionMeta: SelectedInstruction[];
};

const MAX_MANIFEST_ENTRIES = 200;

function manifestBlock(files: string[]): string {
  const head = files.slice(0, MAX_MANIFEST_ENTRIES);
  const truncated = files.length - head.length;
  const body = head.map((p) => `- ${p}`).join("\n");
  return truncated > 0
    ? `${body}\n... (+${truncated} more)`
    : body;
}

export function buildContextBundle(input: ContextBundleInput): ContextBundleOutput {
  const lines: string[] = [];
  lines.push("<builder_context>");
  lines.push(`<locale>${input.locale}</locale>`);
  lines.push(`<draft_workspace>${input.draftWorkspacePath}</draft_workspace>`);
  lines.push(projectSummaryToContextBlock(input.projectSummary));
  lines.push("<file_manifest>");
  lines.push(manifestBlock(input.fileManifest));
  lines.push("</file_manifest>");
  if (input.scopeAnalysis && input.scopeAnalysis.relevantFiles.length > 0) {
    lines.push("<scope_analysis>");
    lines.push(
      "A triage pass already identified the files this request needs. Read and edit " +
        "ONLY these unless your inspection finds they are insufficient — do NOT re-run " +
        "broad discovery (ls/rg over the whole tree) before making the change.",
    );
    lines.push("relevant_files:");
    lines.push(input.scopeAnalysis.relevantFiles.map((p) => `- ${p}`).join("\n"));
    lines.push(`approach: ${input.scopeAnalysis.approach}`);
    lines.push("</scope_analysis>");
  }
  lines.push("<protected_paths>");
  lines.push("blocked:");
  lines.push(input.protectedPaths.blocked.map((p) => `- ${p}`).join("\n"));
  lines.push("allowed_with_audit:");
  lines.push(input.protectedPaths.allowedAudit.map((p) => `- ${p}`).join("\n"));
  lines.push("</protected_paths>");
  lines.push("<validation_rules>");
  lines.push(`typecheck=${input.validationRules.typecheck}`);
  lines.push(`build=${input.validationRules.build}`);
  lines.push(`preview_health=${input.validationRules.previewHealth}`);
  lines.push("</validation_rules>");
  lines.push("<user_prompt>");
  lines.push(input.userPrompt.trim());
  lines.push("</user_prompt>");
  lines.push("</builder_context>");

  for (const instruction of input.selectedInstructions) {
    lines.push("");
    lines.push(wrapSelectedInstruction(instruction));
  }

  if (input.selectedSkills && input.selectedSkills.length > 0 && input.skillRegistry) {
    const skillBlocks = buildSelectedSkillBlocks({
      selected: input.selectedSkills,
      registry: input.skillRegistry,
    });
    for (const block of skillBlocks) {
      lines.push("");
      lines.push(block);
    }
  }

  return {
    prompt: lines.join("\n"),
    selectedInstructionMeta: input.selectedInstructions.map((i) => i.meta),
  };
}
