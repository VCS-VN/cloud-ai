import {
  projectSummaryToContextBlock,
  type ProjectSummary,
} from "./project-summary.server";
import {
  wrapSelectedInstruction,
  type LoadedInstruction,
  type SelectedInstruction,
} from "./instruction-loader.server";

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

  return {
    prompt: lines.join("\n"),
    selectedInstructionMeta: input.selectedInstructions.map((i) => i.meta),
  };
}
