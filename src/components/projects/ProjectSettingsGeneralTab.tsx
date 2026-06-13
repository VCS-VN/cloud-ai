import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Project } from "@/shared/project-types";

function formatCreatedAt(createdAt?: string) {
  if (!createdAt) return "Created time unavailable";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "Created time unavailable";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ProjectSettingsGeneralTab({
  project,
  projectName,
  loading = false,
  deleting = false,
  onProjectNameChange,
  onDelete,
}: {
  project?: Project;
  projectName?: string;
  loading?: boolean;
  deleting?: boolean;
  onProjectNameChange?: (name: string) => void;
  onDelete?: () => void;
}) {
  if (loading || !project) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-4 w-32 animate-pulse rounded-md bg-chalk" />
        <div className="h-10 animate-pulse rounded-md border border-hairline bg-surface" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-hairline bg-surface p-4 shadow-sm transition-colors duration-base">
        <label className="block text-eyebrow font-mono uppercase tracking-wide text-subtle" htmlFor="project-settings-name">
          Project name
        </label>
        <Input
          id="project-settings-name"
          className="mt-2"
          value={projectName ?? project.name}
          onChange={(event) => onProjectNameChange?.(event.currentTarget.value)}
          placeholder="Project name"
        />
      </section>
      <section className="rounded-xl border border-hairline bg-surface p-4 shadow-sm transition-colors duration-base">
        <p className="m-0 text-eyebrow font-mono uppercase tracking-wide text-subtle">
          Created time
        </p>
        <p className="m-0 mt-1 text-ui-sm leading-5 text-ink">
          {formatCreatedAt(project.createdAt)}
        </p>
      </section>
      <section className="rounded-xl border border-danger-bg bg-surface p-4 shadow-sm transition-colors duration-base">
        <p className="m-0 text-eyebrow font-mono uppercase tracking-wide text-danger-fg">
          Danger zone
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="m-0 text-ui-sm leading-5 text-muted">
            Delete separately from Save.
          </p>
          <Button
            variant="unstyled"
            className="inline-flex h-8 shrink-0 items-center rounded-md border border-danger-bg bg-danger-bg px-3 text-eyebrow font-semibold text-danger-fg transition-colors duration-base hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={deleting}
            onClick={onDelete}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </section>
    </div>
  );
}
