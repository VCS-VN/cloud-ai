import type { Project } from "@/shared/project-types";

export type ProjectFilter = "all" | "active" | "draft" | "archived";
export type ProjectSort = "modified" | "created" | "name";

export const SORT_LABELS: Record<ProjectSort, string> = {
  modified: "Last modified",
  created: "Date created",
  name: "Name",
};

export function matchesFilter(project: Project, filter: ProjectFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "active":
      return project.status === "ready" || project.status === "generating";
    case "draft":
      return project.status === "draft" || project.status === 0;
    case "archived":
      return project.status === "failed";
  }
}

export function filterProjects(
  projects: Project[],
  filter: ProjectFilter,
): Project[] {
  return projects.filter((project) => matchesFilter(project, filter));
}

export function sortProjects(
  projects: Project[],
  sort: ProjectSort,
): Project[] {
  const sorted = [...projects];
  switch (sort) {
    case "modified":
      return sorted.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    case "created":
      return sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    case "name":
      return sorted.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
  }
}

export function formatDashboardDate() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export function getFirstName(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return "there";
  const firstToken = trimmed.split(/\s+/)[0];
  return firstToken.includes("@") ? firstToken.split("@")[0] : firstToken;
}

export function getInitials(label: string) {
  return (
    label
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "TM"
  );
}
