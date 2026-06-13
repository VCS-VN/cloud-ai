import type {
  BuilderRunMilestone,
  BuilderRunTaskPhase,
} from "@/features/agents/ui/builder-events";
import type {
  BuilderRunHandle,
  BuilderRunTaskStatus,
} from "@/features/agents/codex/runtime/builder-run-registry.server";
import type { EmitFn } from "@/features/agents/codex/runtime/builder-run.server";

const MILESTONE_TO_BUCKET: Partial<Record<BuilderRunMilestone, BuilderRunTaskPhase>> = {
  loading_context: "prep",
  planning: "prep",
  creating_draft: "build",
  building_pages: "build",
  checking_preview: "verify",
  publishing: "verify",
};

const BUCKET_ORDER: Record<BuilderRunTaskPhase, number> = {
  prep: 0,
  build: 1,
  verify: 2,
};

// FR-006: emit() funnels through the dispatcher's publishBuilderRunEvent
// wrapper, so publish-first is naturally satisfied — the translator+bridge
// receive the published event and persist the matching timeline directive.

// Milestone→bucket auto-advance used by the update / new_route flows, whose
// checklists track coarse phases. The init flow opts out (manualTaskTransitions)
// and drives tasks one at a time via fireTaskStarted/fireTaskCompleted instead.
export function fireTaskTransitions(
  handle: BuilderRunHandle,
  emit: EmitFn,
  enteringMilestone: BuilderRunMilestone,
): void {
  if (!handle.taskList || handle.taskList.length === 0) return;
  const bucket = MILESTONE_TO_BUCKET[enteringMilestone];
  if (!bucket) return;
  const bucketRank = BUCKET_ORDER[bucket];
  const at = Date.now();
  for (const task of handle.taskList) {
    const status = handle.taskStatuses[task.id];
    const taskRank = BUCKET_ORDER[task.phase];
    if (taskRank < bucketRank) {
      if (status === "active") {
        handle.taskStatuses[task.id] = "done";
        emit({ type: "plan.task.completed", runId: handle.runId, taskId: task.id, at });
      }
    } else if (taskRank === bucketRank) {
      if (status === "pending") {
        handle.taskStatuses[task.id] = "active";
        emit({ type: "plan.task.started", runId: handle.runId, taskId: task.id, at });
      }
    }
  }
}

// Mark exactly ONE task active and emit plan.task.started. The init driver
// calls this at the precise moment it begins each batch, so the checklist shows
// the single task actually running — not every task in a phase bucket at once.
export function fireTaskStarted(
  handle: BuilderRunHandle,
  emit: EmitFn,
  taskId: string,
): void {
  if (!handle.taskList || handle.taskList.length === 0) return;
  if (handle.taskStatuses[taskId] === "active") return;
  handle.taskStatuses[taskId] = "active";
  emit({ type: "plan.task.started", runId: handle.runId, taskId, at: Date.now() });
}

// Mark exactly ONE task done and emit plan.task.completed. Paired with
// fireTaskStarted by the driver to advance the checklist one task at a time.
export function fireTaskCompleted(
  handle: BuilderRunHandle,
  emit: EmitFn,
  taskId: string,
): void {
  if (!handle.taskList || handle.taskList.length === 0) return;
  if (handle.taskStatuses[taskId] === "done") return;
  handle.taskStatuses[taskId] = "done";
  emit({ type: "plan.task.completed", runId: handle.runId, taskId, at: Date.now() });
}

export function fireTaskPauseAll(handle: BuilderRunHandle, emit: EmitFn): void {
  if (!handle.taskList || handle.taskList.length === 0) return;
  const at = Date.now();
  for (const task of handle.taskList) {
    if (handle.taskStatuses[task.id] === "active") {
      handle.taskStatuses[task.id] = "paused";
      emit({
        type: "plan.task.paused",
        runId: handle.runId,
        taskId: task.id,
        at,
      });
    }
  }
}

export function fireTaskResumeAll(handle: BuilderRunHandle, emit: EmitFn): void {
  if (!handle.taskList || handle.taskList.length === 0) return;
  const at = Date.now();
  for (const task of handle.taskList) {
    if (handle.taskStatuses[task.id] === "paused") {
      handle.taskStatuses[task.id] = "active";
      emit({
        type: "plan.task.resumed",
        runId: handle.runId,
        taskId: task.id,
        at,
      });
    }
  }
}

export function fireRemainingTasksComplete(
  handle: BuilderRunHandle,
  emit: EmitFn,
): void {
  if (!handle.taskList || handle.taskList.length === 0) return;
  const at = Date.now();
  for (const task of handle.taskList) {
    const status: BuilderRunTaskStatus | undefined = handle.taskStatuses[task.id];
    if (status !== "done") {
      handle.taskStatuses[task.id] = "done";
      emit({
        type: "plan.task.completed",
        runId: handle.runId,
        taskId: task.id,
        at,
      });
    }
  }
}
