import { AgentToolRegistry } from "./agent-tool-registry";
import { ProjectWorkspaceService } from "./project-workspace-service";

export type AgentRuntimeRunInput = {
  projectId: string;
  userId?: string;
  prompt: string;
  mode: "init" | "edit";
  emit?: (content: string) => Promise<void> | void;
  signal?: AbortSignal;
};

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
}

function buildInitPrompt(prompt: string) {
  return [
    "Initialize a TanStack Start storefront project from this request:",
    `- ${prompt}`,
    "",
    "Use TailwindCSS, shadcn-style components, axios instance, zod, jotai, and react-hook-form.",
    "Create a clean starter structure and summarize the generated files.",
  ].join("\n");
}

export class AgentRuntime {
  constructor(
    private readonly workspaceService: ProjectWorkspaceService,
    private readonly tools = new AgentToolRegistry(workspaceService),
  ) {}

  async run(input: AgentRuntimeRunInput) {
    throwIfAborted(input.signal);

    const streamedSections: string[] = [];
    const pushSection = async (lines: string[]) => {
      const chunk = `${lines.join("\n")}\n\n`;
      streamedSections.push(chunk);
      await input.emit?.(chunk);
    };

    await pushSection([
      "### Status",
      "- Setting up your project workspace.",
      `- Task: ${input.mode === "init" ? "Initialize storefront starter" : "Apply workspace update"}.`,
    ]);

    await this.workspaceService.ensureWorkspace(input.projectId);
    throwIfAborted(input.signal);

    let createdFiles: string[] = [];
    if (input.mode === "init") {
      await pushSection([
        "### Plan",
        "- Scaffold a TanStack Start app foundation.",
        "- Add the default frontend stack and starter files.",
        "- Sync the generated file tree for preview.",
      ]);

      createdFiles = await this.workspaceService.scaffoldTanStackStartProject(
        input.projectId,
        buildInitPrompt(input.prompt),
      );
      throwIfAborted(input.signal);

      await pushSection([
        "### Created files",
        `- Generated ${createdFiles.length} starter files for the initial workspace.`,
        ...createdFiles.slice(0, 6).map((filePath) => `- \`${filePath}\``),
        ...(createdFiles.length > 6
          ? [`- Plus ${createdFiles.length - 6} more files in the starter scaffold.`]
          : []),
      ]);
    }

    const nodes = await this.tools.syncTree(input.projectId, input.userId);
    throwIfAborted(input.signal);

    const summary = [
      "### Status",
      "- Initialized your TanStack Start workspace.",
      "",
      "### Checks",
      "- Workspace scaffold completed successfully.",
      `- Synced ${nodes.length} file nodes for preview.`,
      "",
      "### Next steps",
      "- Review the generated routes and UI structure.",
      "- Send a follow-up prompt to refine pages, data flow, or components.",
    ].join("\n");

    return {
      summary,
      filesCreated: createdFiles.length,
      filesSynced: nodes.length,
      streamedContent: streamedSections.join(""),
    };
  }
}
