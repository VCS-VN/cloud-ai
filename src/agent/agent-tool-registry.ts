import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ProjectWorkspaceService } from "./project-workspace-service";

const execFileAsync = promisify(execFile);
const ALLOWED_COMMANDS = new Set(["pnpm install", "pnpm build", "pnpm typecheck", "pnpm lint"]);

export class AgentToolRegistry {
  constructor(private readonly workspaceService: ProjectWorkspaceService) {}

  async listFiles(projectId: string) {
    const workspacePath = await this.workspaceService.ensureWorkspace(projectId);
    return workspacePath;
  }

  async readFile(projectId: string, relativePath: string) {
    return this.workspaceService.readTextFile(projectId, relativePath);
  }

  async writeFile(projectId: string, relativePath: string, content: string) {
    await this.workspaceService.writeTextFile(projectId, relativePath, content);
  }

  async runCommand(projectId: string, command: string) {
    if (!ALLOWED_COMMANDS.has(command)) throw new Error("Command is not allowed for the agent workspace.");
    const [binary, ...args] = command.split(" ");
    const cwd = await this.workspaceService.ensureWorkspace(projectId);
    return execFileAsync(binary, args, { cwd, timeout: 120000 });
  }

  async syncTree(projectId: string, userId?: string) {
    return this.workspaceService.syncFileTree(projectId, userId);
  }
}
