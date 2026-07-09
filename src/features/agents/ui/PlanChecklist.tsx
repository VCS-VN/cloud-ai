import { Check, ChevronDown, Loader2, SquareCheckBig } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { TodoItem } from "@/shared/project-types";

export type PlanChecklistProps = {
  todoItems: TodoItem[] | null;
  /** True when state.activeRun is null (run terminated). Spinners stop. */
  runClosed: boolean;
};

type DisplayStatus = "upcoming" | "active" | "done";

const STATUS_LABEL: Record<DisplayStatus, string> = {
  upcoming: "Upcoming",
  active: "In progress",
  done: "Completed",
};

function StatusIcon({
  status,
  animate,
  index,
}: {
  status: DisplayStatus;
  animate: boolean;
  index?: number;
}) {
  switch (status) {
    case "upcoming":
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
    case "done":
      return (
        <span aria-hidden className="plan-status-icon plan-status-done">
          <Check size={10} />
        </span>
      );
  }
}

export function PlanChecklist({ todoItems, runClosed }: PlanChecklistProps) {
  const [expanded, setExpanded] = useState(true);

  const summary = useMemo(() => {
    if (!todoItems || todoItems.length === 0) {
      return { activeIndex: -1, activeTitle: null, doneCount: 0, total: 0 };
    }
    const total = todoItems.length;
    const doneCount = todoItems.filter((t) => t.completed).length;
    // First not-completed item is "in progress"; earlier are done, later upcoming.
    const activeIndex = todoItems.findIndex((t) => !t.completed);
    const activeTitle = activeIndex >= 0 ? todoItems[activeIndex].text : null;
    return { activeIndex, activeTitle, doneCount, total };
  }, [todoItems]);

  if (!todoItems || todoItems.length === 0) return null;

  const allDone = summary.doneCount === summary.total;

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

      <div
        className={`plan-checklist-collapse ${expanded ? "" : "plan-checklist-collapse-closed"}`}
      >
        <div className="plan-checklist-collapse-inner">
          <ul id={listId} role="list" className="plan-checklist-body">
            {todoItems.map((item, index) => {
              const status: DisplayStatus = item.completed
                ? "done"
                : index === summary.activeIndex
                  ? "active"
                  : "upcoming";
              const isActive = status === "active";
              return (
                <li
                  key={item.id}
                  role="listitem"
                  aria-busy={isActive && !runClosed}
                  className={`plan-task-row ${isActive ? "plan-task-row-active" : ""} ${status === "upcoming" ? "plan-task-row-pending" : ""}`}
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
                      {item.text}
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
        </div>
      </div>
    </section>
  );
}
