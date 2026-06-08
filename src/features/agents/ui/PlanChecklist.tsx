import { useMemo, useState } from "react";
import type { PlanTask, PlanTaskStatus } from "@/shared/project-types";

export type PlanChecklistProps = {
  tasks: PlanTask[] | null;
  statuses: Record<string, PlanTaskStatus>;
  /** True when state.activeRun is null (run terminated). Spinners stop. */
  runClosed: boolean;
};

const STATUS_LABEL: Record<PlanTaskStatus, string> = {
  pending: "Pending",
  active: "In progress",
  paused: "Paused",
  done: "Completed",
};

function StatusIcon({
  status,
  animate,
}: {
  status: PlanTaskStatus;
  animate: boolean;
}) {
  const baseClass = "inline-block size-4 shrink-0 text-center text-sm leading-4";
  switch (status) {
    case "pending":
      return (
        <span aria-hidden className={`${baseClass} text-muted-foreground`}>○</span>
      );
    case "active":
      return (
        <span
          aria-hidden
          className={`${baseClass} text-primary ${animate ? "animate-pulse" : ""}`}
        >
          ◐
        </span>
      );
    case "paused":
      return (
        <span aria-hidden className={`${baseClass} text-muted-foreground`}>⏸</span>
      );
    case "done":
      return (
        <span aria-hidden className={`${baseClass} text-emerald-600`}>✓</span>
      );
  }
}

export function PlanChecklist({ tasks, statuses, runClosed }: PlanChecklistProps) {
  const [expanded, setExpanded] = useState(true);

  const summary = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return { activeId: null, activeTitle: null, doneCount: 0, total: 0 };
    }
    const total = tasks.length;
    const doneCount = tasks.filter((t) => statuses[t.id] === "done").length;
    const active =
      tasks.find((t) => statuses[t.id] === "active") ??
      tasks.find((t) => statuses[t.id] === "paused") ??
      tasks.find((t) => statuses[t.id] === "pending");
    return {
      activeId: active?.id ?? null,
      activeTitle: active?.title ?? null,
      doneCount,
      total,
    };
  }, [tasks, statuses]);

  if (!tasks || tasks.length === 0) return null;

  const allDone = summary.doneCount === summary.total;
  const headerStatus: PlanTaskStatus = runClosed
    ? allDone
      ? "done"
      : "paused"
    : summary.activeId
      ? statuses[summary.activeId] ?? "active"
      : "active";

  const headerSummaryText = runClosed
    ? `${allDone ? "Completed" : "Stopped"} ${summary.doneCount} of ${summary.total} tasks`
    : `${summary.doneCount}/${summary.total}: ${summary.activeTitle ?? ""}`;

  const liveAnnouncement = runClosed
    ? `Run finished. ${summary.doneCount} of ${summary.total} tasks completed.`
    : summary.activeTitle
      ? `Working on: ${summary.activeTitle}`
      : "";

  const listId = "plan-checklist-list";

  return (
    <section
      aria-label="Run task checklist"
      className="rounded-md border border-border bg-card/60 px-3 py-2 text-sm shadow-sm"
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 text-left text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden className="text-muted-foreground">
          {expanded ? "▾" : "▸"}
        </span>
        <StatusIcon status={headerStatus} animate={!runClosed} />
        <span className="flex-1 truncate font-medium">{headerSummaryText}</span>
      </button>

      <p className="sr-only" aria-live="polite">
        {liveAnnouncement}
      </p>

      {expanded ? (
        <ul
          id={listId}
          role="list"
          className="mt-2 flex flex-col gap-1.5 border-t border-border/60 pt-2"
        >
          {tasks.map((task) => {
            const status = statuses[task.id] ?? "pending";
            const isActive = status === "active";
            return (
              <li
                key={task.id}
                role="listitem"
                aria-busy={isActive && !runClosed}
                className="flex items-start gap-2"
              >
                <StatusIcon status={status} animate={isActive && !runClosed} />
                <span className="sr-only">{STATUS_LABEL[status]}.</span>
                <span
                  className={
                    status === "done"
                      ? "flex-1 text-muted-foreground line-through"
                      : "flex-1 text-foreground"
                  }
                >
                  {task.title}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
