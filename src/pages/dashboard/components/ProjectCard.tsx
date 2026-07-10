import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, MoreHorizontal, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Project } from "@/shared/project-types";
import { formatRelative } from "../utils";

export function ProjectCard({
  project,
  index,
  initials,
  onDelete,
}: {
  project: Project;
  index: number;
  initials: string;
  onDelete: (projectId: string) => Promise<void>;
}) {
  const [deleteExpanded, setDeleteExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const status = getStatus(project.status);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await onDelete(project.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="group relative rounded-[18px] border border-hairline bg-paper/60 p-3 transition duration-base hover:-translate-y-0.5 hover:bg-paper hover:shadow-card-hover">
      <Link
        to="/projects/$projectId"
        params={{ projectId: project.id }}
        className="block"
      >
        <ProjectThumbnail index={index} project={project} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold tracking-tight">
              {project.name}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs text-muted">
              {project.description ||
                "Describe an idea and let Cloud AI build the first draft."}
            </p>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-subtle opacity-0 transition duration-base group-hover:opacity-100">
            <MoreHorizontal aria-hidden="true" size={16} />
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex -space-x-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[10px] font-semibold text-paper ring-2 ring-surface">
              {initials}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <span className={status.className}>
              <span className={status.dotClassName} />
              {status.label}
            </span>
            <span className="font-mono">
              {formatRelative(project.updatedAt)}
            </span>
          </div>
        </div>
      </Link>

      <div className="absolute right-3 top-3 z-10">
        {deleteExpanded ? (
          <div className="flex items-center gap-1 rounded-pill border border-danger-bg bg-surface p-1 text-danger-fg shadow-card">
            <Button
              variant="unstyled"
              type="button"
              onClick={() => void confirmDelete()}
              disabled={deleting}
              aria-busy={deleting}
              className="inline-flex h-7 items-center gap-1 rounded-pill px-2 text-eyebrow font-semibold text-danger-fg transition-colors duration-base hover:bg-danger-bg focus-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? (
                <Loader2
                  aria-hidden="true"
                  className="animate-spin"
                  size={13}
                />
              ) : (
                <Trash2 aria-hidden="true" size={13} />
              )}
              Delete
            </Button>
            <Button
              variant="unstyled"
              type="button"
              onClick={() => setDeleteExpanded(false)}
              disabled={deleting}
              aria-label="Cancel delete"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors duration-base hover:bg-ink/[0.04] hover:text-ink focus-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X aria-hidden="true" size={13} />
            </Button>
          </div>
        ) : (
          <Button
            variant="unstyled"
            type="button"
            onClick={() => setDeleteExpanded(true)}
            aria-label="Delete project"
            title="Delete project"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-danger-bg bg-surface text-danger-fg shadow-card transition-colors duration-base hover:bg-danger-bg focus-ring"
          >
            <Trash2 aria-hidden="true" size={14} />
          </Button>
        )}
      </div>
    </article>
  );
}

function ProjectThumbnail({
  index,
  project,
}: {
  index: number;
  project: Project;
}) {
  const variant = index % 5;

  if (variant === 2) {
    return (
      <div className="relative mb-3 aspect-[16/10] overflow-hidden rounded-[14px] border border-hairline bg-ink">
        <div className="absolute inset-4 grid grid-cols-3 gap-1.5">
          <div className="row-span-2 rounded-lg bg-stone-700" />
          <div className="rounded-lg bg-stone-500" />
          <div className="rounded-lg bg-stone-600" />
          <div className="rounded-lg bg-stone-400" />
          <div className="rounded-lg bg-stone-500" />
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="font-mono text-[8px] uppercase tracking-widest text-paper/50">
            Project · 2026
          </div>
          <div className="mt-1 truncate font-semibold text-paper">
            {project.name}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 1) {
    return (
      <div className="relative mb-3 aspect-[16/10] overflow-hidden rounded-[14px] border border-hairline bg-[#F7F3EC]">
        <div className="absolute inset-3 grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="rounded-xl border border-hairline bg-surface p-2"
            >
              <div className="aspect-square rounded-lg bg-stone-200" />
              <div className="mt-2 h-2 w-3/4 rounded bg-ink/70" />
              <div className="mt-1 h-1.5 w-1/2 rounded bg-ink/25" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="thumb-pattern relative mb-3 aspect-[16/10] overflow-hidden rounded-[14px] border border-hairline bg-[#F5F1EA]">
      <div className="absolute inset-3 overflow-hidden rounded-xl border border-hairline bg-surface">
        <div className="flex h-7 items-center gap-1.5 border-b border-hairline bg-white/70 px-3">
          <span className="h-2 w-2 rounded-full bg-stone-300" />
          <span className="h-2 w-2 rounded-full bg-stone-300" />
          <span className="h-2 w-2 rounded-full bg-stone-300" />
          <span className="ml-2 h-2 w-28 rounded bg-stone-200" />
        </div>
        <div className="p-4">
          <div className="h-3 w-16 rounded bg-ink" />
          <div className="mt-3 h-5 w-4/5 rounded bg-ink/85" />
          <div className="mt-1.5 h-5 w-3/5 rounded bg-ink/85" />
          <div className="mt-3 h-2 w-2/3 rounded bg-ink/25" />
          <div className="mt-4 flex gap-2">
            <div className="h-7 w-24 rounded-lg bg-ink" />
            <div className="h-7 w-20 rounded-lg border border-hairline" />
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatus(status: Project["status"]) {
  if (status === "ready") {
    return {
      label: "Live",
      className:
        "inline-flex h-6 items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 text-emerald-700",
      dotClassName: "h-1.5 w-1.5 rounded-full bg-emerald-600",
    };
  }
  if (status === "failed") {
    return {
      label: "Archived",
      className:
        "inline-flex h-6 items-center gap-1 rounded-full border border-danger-bg bg-danger-bg px-2 text-danger-fg",
      dotClassName: "h-1.5 w-1.5 rounded-full bg-danger-dot",
    };
  }
  if (status === "generating") {
    return {
      label: "Building",
      className:
        "inline-flex h-6 items-center gap-1 rounded-full border border-hairline bg-stone-100 px-2 text-stone-700",
      dotClassName: "h-1.5 w-1.5 rounded-full bg-ink",
    };
  }
  return {
    label: "Draft",
    className:
      "inline-flex h-6 items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2 text-amber-700",
    dotClassName: "h-1.5 w-1.5 rounded-full bg-amber-500",
  };
}
