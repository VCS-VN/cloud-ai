import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PathGuard } from "../security/path-guard.server";
import { isProtectedProjectEnvPath } from "../code-tools/services/project-path-guard.server";

export class ProjectFileStore {
  constructor(private readonly pathGuard = new PathGuard()) {}

  getWorkspacePath(projectId: string) {
    return this.pathGuard.getWorkspacePath(projectId);
  }

  async ensureWorkspace(projectId: string) {
    const workspacePath = this.getWorkspacePath(projectId);
    await mkdir(workspacePath, { recursive: true });
    return workspacePath;
  }

  async readTextFile(projectId: string, relativePath: string) {
    this.assertAgentAccessiblePath(relativePath);
    return readFile(this.pathGuard.resolveProjectPath(projectId, relativePath), "utf8");
  }

  async writeTextFile(projectId: string, relativePath: string, content: string) {
    this.assertAgentAccessiblePath(relativePath);
    await this.writeManagedTextFile(projectId, relativePath, content);
  }

  async deleteFile(projectId: string, relativePath: string) {
    this.assertAgentAccessiblePath(relativePath);
    await rm(this.pathGuard.resolveProjectPath(projectId, relativePath), { force: true });
  }

  async readManagedEnvFile(projectId: string) {
    return readFile(this.pathGuard.resolveProjectPath(projectId, ".env"), "utf8");
  }

  async writeManagedEnvFile(projectId: string, content: string) {
    await this.writeManagedTextFile(projectId, ".env", content);
  }

  private async writeManagedTextFile(projectId: string, relativePath: string, content: string) {
    const targetPath = this.pathGuard.resolveProjectPath(projectId, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, "utf8");
  }

  private assertAgentAccessiblePath(relativePath: string) {
    if (isProtectedProjectEnvPath(relativePath)) {
      throw new Error("Generated project .env is managed by the Builder app process and cannot be accessed by the AI Agent.");
    }
  }
}
