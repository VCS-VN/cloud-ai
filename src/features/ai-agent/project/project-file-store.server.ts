import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PathGuard } from "../security/path-guard.server";

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
    return readFile(this.pathGuard.resolveProjectPath(projectId, relativePath), "utf8");
  }

  async writeTextFile(projectId: string, relativePath: string, content: string) {
    const targetPath = this.pathGuard.resolveProjectPath(projectId, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, "utf8");
  }

  async deleteFile(projectId: string, relativePath: string) {
    await rm(this.pathGuard.resolveProjectPath(projectId, relativePath), { force: true });
  }
}
