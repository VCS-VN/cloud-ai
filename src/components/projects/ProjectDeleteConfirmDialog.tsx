import { Button } from "@/components/ui/button";
import type { Project } from "@/shared/project-types";

export function ProjectDeleteConfirmDialog({
  open,
  project,
  deleting = false,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  project?: Pick<Project, "name">;
  deleting?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--color-overlay-scrim)_56%,transparent)] p-4" role="alertdialog" aria-modal="true" aria-label="Delete project confirmation">
      <Button
        variant="unstyled"
        className="absolute inset-0 cursor-default"
        type="button"
        aria-label="Cancel delete project"
        disabled={deleting}
        onClick={onCancel}
      />
      <section className="relative w-full max-w-[420px] rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] p-6 shadow-2xl">
        <p className="m-0 text-[12px] uppercase tracking-[0.08em] text-[var(--app-muted)]">
          Confirm delete
        </p>
        <h2 className="m-0 mt-xs text-[24px] font-[580] leading-8 tracking-[-0.03em] text-[var(--app-text)]">
          Delete this project?
        </h2>
        <p className="m-0 mt-sm text-[14px] leading-6 text-[var(--app-muted)]">
          This will remove {project?.name ? `“${project.name}”` : "this project"} from your projects. You will leave the project only after deletion succeeds.
        </p>
        {error ? (
          <p className="m-0 mt-sm rounded-md border border-[var(--app-border-strong)] bg-[var(--app-danger-bg)] px-2 py-1 text-[13px] leading-5 text-[var(--app-danger-text)]">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="unstyled"
            className="rounded-pill border border-[var(--app-border)] bg-[var(--app-control)] px-4 py-1 text-[14px] font-[560] text-[var(--app-text)] transition-colors duration-200 hover:border-[var(--app-border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={deleting}
            onClick={onCancel}
          >
            Keep project
          </Button>
          <Button
            variant="unstyled"
            className="rounded-pill bg-[var(--app-danger-bg)] px-4 py-1 text-[14px] font-[560] text-[var(--app-danger-text)] ring-1 ring-[var(--app-border-strong)] transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? "Deleting..." : "Delete project"}
          </Button>
        </div>
      </section>
    </div>
  );
}
