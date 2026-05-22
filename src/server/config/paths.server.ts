import path from "node:path";

export function getProjectsRoot() {
  const configuredRoot = process.env.PROJECTS_ROOT?.trim();
  if (configuredRoot) return path.resolve(configuredRoot);
  if (process.env.NODE_ENV === "production") return "/var/bin/projects";
  return path.resolve(process.cwd(), "projects");
}

export function getProjectWorkspaceRoot(projectId: string) {
  return path.join(getProjectsRoot(), projectId);
}
