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
      <div className="space-y-xs" aria-busy="true">
        <div className="h-4 w-32 animate-pulse rounded-md bg-[var(--app-control)]" />
        <div className="h-10 animate-pulse rounded-md border border-[var(--app-border)] bg-[var(--app-panel)]" />
      </div>
    );
  }

  return (
    <div className="space-y-sm">
      <section className="rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] p-sm transition-colors duration-200">
        <label className="block text-[11px] uppercase tracking-[0.08em] text-[var(--app-muted)]" htmlFor="project-settings-name">
          Project name
        </label>
        <Input
          id="project-settings-name"
          className="mt-xs h-9 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] px-sm text-[14px] font-[520] text-[var(--app-text)] outline-none transition-colors duration-200 placeholder:text-[var(--app-muted)] focus:border-[var(--app-border-strong)] focus:ring-2 focus:ring-[var(--app-focus-ring)]"
          value={projectName ?? project.name}
          onChange={(event) => onProjectNameChange?.(event.currentTarget.value)}
          placeholder="Project name"
        />
      </section>
      <section className="rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] p-sm transition-colors duration-200">
        <p className="m-0 text-[11px] uppercase tracking-[0.08em] text-[var(--app-muted)]">
          Created time
        </p>
        <p className="mt-xxs m-0 text-[13px] leading-5 text-[var(--app-text)]">
          {formatCreatedAt(project.createdAt)}
        </p>
      </section>
      <section className="rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] p-sm transition-colors duration-200">
        <p className="m-0 text-[11px] uppercase tracking-[0.08em] text-[var(--app-muted)]">
          Danger zone
        </p>
        <div className="mt-xs flex items-center justify-between gap-sm">
          <p className="m-0 text-[12px] leading-5 text-[var(--app-muted)]">
            Delete separately from Save.
          </p>
          <Button
            variant="unstyled"
            className="shrink-0 rounded-pill bg-[var(--app-danger-bg)] px-sm py-xxs text-[13px] font-[560] text-[var(--app-danger-text)] ring-1 ring-[var(--app-border-strong)] transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-60"
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
