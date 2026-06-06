import type { BuilderRunEvent } from "@/features/agents/ui/builder-events";
import type { BuilderRunStatus } from "@/features/agents/ui/builder-run-status";

export type BuilderRunHandle = {
  runId: string;
  projectId: string;
  userId: string | undefined;
  status: BuilderRunStatus;
  abortController: AbortController;
  events: BuilderRunEvent[];
  subscribers: Set<(event: BuilderRunEvent) => void>;
  startedAt: number;
  completedAt?: number;
};

const registry = new Map<string, BuilderRunHandle>();
const activeByProject = new Map<string, string>();

export class ActiveRunExistsError extends Error {
  constructor(public readonly projectId: string, public readonly runId: string) {
    super(`active_run_exists:${projectId}:${runId}`);
  }
}

export function createBuilderRunHandle(input: {
  runId: string;
  projectId: string;
  userId: string | undefined;
}): BuilderRunHandle {
  if (activeByProject.has(input.projectId)) {
    throw new ActiveRunExistsError(input.projectId, activeByProject.get(input.projectId)!);
  }
  const handle: BuilderRunHandle = {
    runId: input.runId,
    projectId: input.projectId,
    userId: input.userId,
    status: "queued",
    abortController: new AbortController(),
    events: [],
    subscribers: new Set(),
    startedAt: Date.now(),
  };
  registry.set(input.runId, handle);
  activeByProject.set(input.projectId, input.runId);
  return handle;
}

export function getBuilderRunHandle(runId: string): BuilderRunHandle | undefined {
  return registry.get(runId);
}

export function getActiveRunForProject(projectId: string): string | undefined {
  return activeByProject.get(projectId);
}

export function publishBuilderRunEvent(handle: BuilderRunHandle, event: BuilderRunEvent): void {
  handle.events.push(event);
  if (event.type === "milestone") handle.status = event.milestone;
  if (event.type === "done") {
    handle.status = "done";
    handle.completedAt = event.at;
    activeByProject.delete(handle.projectId);
  }
  if (event.type === "failed") {
    handle.status = "failed";
    handle.completedAt = event.at;
    activeByProject.delete(handle.projectId);
  }
  if (event.type === "cancelled") {
    handle.status = "cancelled";
    handle.completedAt = event.at;
    activeByProject.delete(handle.projectId);
  }
  for (const listener of handle.subscribers) {
    try {
      listener(event);
    } catch {
      // ignore listener errors
    }
  }
}

export function clearTerminatedRuns(maxAgeMs: number, now: number = Date.now()): void {
  for (const [id, handle] of registry) {
    if (handle.completedAt && now - handle.completedAt > maxAgeMs) {
      registry.delete(id);
    }
  }
}

export function resetBuilderRunRegistryForTest(): void {
  registry.clear();
  activeByProject.clear();
}
