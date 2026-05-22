import path from "node:path";
import { getProjectsRoot } from "@/server/config/paths.server";

const BLOCKED_SEGMENTS = new Set([".git", "node_modules"]);

export class PathGuard {
  constructor(private readonly rootPath = getProjectsRoot()) {}

  getWorkspacePath(projectId: string) {
    if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error("Invalid project id.");
    return path.join(this.rootPath, projectId);
  }

  resolveProjectPath(projectId: string, relativePath = ".") {
    this.assertSafeRelativePath(relativePath);
    const workspacePath = this.getWorkspacePath(projectId);
    const resolvedPath = path.resolve(workspacePath, relativePath);
    if (resolvedPath !== workspacePath && !resolvedPath.startsWith(`${workspacePath}${path.sep}`)) {
      throw new Error("Path escapes the project workspace.");
    }
    return resolvedPath;
  }

  assertSafeRelativePath(relativePath: string) {
    if (!relativePath.trim()) throw new Error("Path is required.");
    if (relativePath.startsWith("~")) throw new Error("Home paths are not allowed.");
    const normalized = relativePath.replaceAll("\\", "/");
    const parts = normalized.split("/").filter(Boolean);
    if (parts.includes("..")) throw new Error("Parent directory traversal is not allowed.");
    if (parts.some((part) => BLOCKED_SEGMENTS.has(part))) throw new Error("Path targets a blocked directory.");
  }
}
