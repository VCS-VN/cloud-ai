import { EmptyState } from "../common/EmptyState";
import { ErrorState } from "../common/ErrorState";
import { LoadingState } from "../common/LoadingState";
import type { Project } from "@/shared/project-types";
import { ProjectListItem } from "./ProjectListItem";

type ProjectListProps = {
  projects: Project[];
  selectedProjectId?: string;
  loading?: boolean;
  error?: string;
  searchQuery?: string;
  variant?: "grid" | "list";
  onSelectProject: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => Promise<void> | void;
  onCreateProject?: () => void;
  onClearSearch?: () => void;
};

export function ProjectList({
  projects,
  selectedProjectId,
  loading = false,
  error,
  searchQuery = "",
  variant = "grid",
  onSelectProject,
  onDeleteProject,
  onCreateProject,
  onClearSearch,
}: ProjectListProps) {
  if (loading) return <LoadingState label="Loading projects..." />;

  if (error)
    return <ErrorState title="Unable to load projects" message={error} />;

  if (projects.length === 0) {
    const hasSearch = searchQuery.trim().length > 0;

    return (
      <EmptyState
        tone={hasSearch ? "plain" : "cream"}
        title={hasSearch ? "No projects found" : "No website projects yet"}
        description={
          hasSearch
            ? "Try another keyword or clear search to see all projects."
            : "Start with a short description of the website you want to create."
        }
        action={
          hasSearch && onClearSearch ? (
            <button
              className="builder-button bg-[var(--app-panel)] text-[var(--app-text)] ring-1 ring-[var(--app-border)]"
              type="button"
              onClick={onClearSearch}
            >
              Clear search
            </button>
          ) : onCreateProject ? (
            <button
              className="builder-button"
              type="button"
              onClick={onCreateProject}
            >
              Create first project
            </button>
          ) : null
        }
      />
    );
  }

  return (
    <section
      className={
        variant === "grid"
          ? "grid gap-sm sm:grid-cols-4 2xl:grid-cols-3"
          : "flex flex-col gap-sm"
      }
      aria-label="Project list"
    >
      {projects.map((project) => (
        <ProjectListItem
          key={project.id}
          project={project}
          selected={project.id === selectedProjectId}
          variant={variant}
          onSelect={onSelectProject}
          onDelete={onDeleteProject}
        />
      ))}
    </section>
  );
}
