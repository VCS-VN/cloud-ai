import { Check, ChevronDown, Loader2, Pause, SquareCheckBig } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
  index,
}: {
  status: PlanTaskStatus;
  animate: boolean;
  index?: number;
}) {
  switch (status) {
    case "pending":
      return (
        <span aria-hidden className="plan-status-icon plan-status-pending">
          {typeof index === "number" ? index + 1 : ""}
        </span>
      );
    case "active":
      return (
        <span aria-hidden className="plan-status-icon plan-status-active">
          <Loader2 size={12} className={animate ? "animate-spin" : undefined} />
        </span>
      );
    case "paused":
      return (
        <span aria-hidden className="plan-status-icon plan-status-paused">
          <Pause size={10} />
        </span>
      );
    case "done":
      return (
        <span aria-hidden className="plan-status-icon plan-status-done">
          <Check size={10} />
        </span>
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
    : `${summary.doneCount} / ${summary.total} done${summary.activeTitle ? ` · ${summary.activeTitle}` : ""}`;

  const liveAnnouncement = runClosed
    ? `Run finished. ${summary.doneCount} of ${summary.total} tasks completed.`
    : summary.activeTitle
      ? `Working on: ${summary.activeTitle}`
      : "";

  const listId = "plan-checklist-list";

  const showRunningBadge = !runClosed && !allDone;

  return (
    <section aria-label="Run task checklist" className="plan-checklist">
      <Button
        variant="unstyled"
        type="button"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded((prev) => !prev)}
        className="plan-checklist-toggle"
      >
        <span className="plan-checklist-iconbox" aria-hidden="true">
          <SquareCheckBig size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block plan-checklist-title">Tasks</span>
          <span className="block plan-checklist-summary">{headerSummaryText}</span>
        </span>
        {showRunningBadge ? <span className="plan-checklist-badge">Running</span> : null}
        <ChevronDown
          aria-hidden="true"
          size={16}
          className={`plan-checklist-chevron ${expanded ? "" : "plan-checklist-chevron-collapsed"}`}
        />
      </Button>

      <p className="sr-only" aria-live="polite">
        {liveAnnouncement}
      </p>

      {expanded ? (
        <ul id={listId} role="list" className="plan-checklist-body">
          {tasks.map((task, index) => {
            const status = statuses[task.id] ?? "pending";
            const isActive = status === "active";
            return (
              <li
                key={task.id}
                role="listitem"
                aria-busy={isActive && !runClosed}
                className={`plan-task-row ${isActive ? "plan-task-row-active" : ""} ${status === "pending" ? "plan-task-row-pending" : ""}`}
              >
                <StatusIcon
                  status={status}
                  animate={isActive && !runClosed}
                  index={index}
                />
                <span className="sr-only">{STATUS_LABEL[status]}.</span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block plan-task-title ${isActive ? "plan-task-title-active" : ""} ${status === "done" ? "plan-task-title-done" : ""}`}
                  >
                    {task.title}
                  </span>
                  <span
                    className={`block plan-task-meta ${isActive ? "plan-task-meta-active" : ""}`}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
