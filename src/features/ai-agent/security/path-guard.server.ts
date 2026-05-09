import path from "node:path";

const BLOCKED_SEGMENTS = new Set([".git", "node_modules"]);
const BLOCKED_FILES = new Set([".env", ".env.local", ".env.production", ".env.development"]);

export class PathGuard {
  constructor(private readonly rootPath = path.resolve(process.cwd(), "projects")) {}

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
    if (parts.some((part) => BLOCKED_FILES.has(part))) throw new Error("Path targets a blocked secret file.");
  }
}
