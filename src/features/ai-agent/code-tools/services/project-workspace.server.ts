import { access } from "node:fs/promises";
import { resolve } from "node:path";
import type { ToolExecutionContext } from "../code-agent-types";

export type ProjectWorkspace = {
  projectId: string;
  workspaceRoot: string;
};

export async function resolveProjectWorkspace(context: ToolExecutionContext): Promise<ProjectWorkspace> {
  const workspaceRoot = resolve(context.workspaceRoot);
  await access(workspaceRoot);
  return { projectId: context.projectId, workspaceRoot };
}
