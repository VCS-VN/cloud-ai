import type { RunStreamEvent, RuntimeStreamEvent } from "@/shared/project-types";
import { redactJson } from "@/features/ai-agent/security/secret-redactor";

const textEncoder = new TextEncoder();

export const RUN_HEARTBEAT_MS = 15000;

/**
 * A run hub fans a single run's event stream out to multiple SSE subscribers
 * (multi-tab, reload). Events are buffered for the full run lifetime so a
 * subscriber joining mid-run replays everything from the start.
 *
 * The orchestrator loop is driven by exactly one producer; `claimProducer`
 * returns true only to the first caller. Subsequent subscribers attach as
 * read-only listeners. Subscriber disconnect does NOT abort the run — only an
 * explicit stop does (see abortRun).
 */
type RunHub = {
  runId: string;
  subscribers: Set<(event: RunStreamEvent) => void>;
  buffer: RunStreamEvent[];
  abortController: AbortController;
  producerClaimed: boolean;
  terminal: boolean;
};

const runHubs = new Map<string, RunHub>();

/**
 * Runs whose producer is expected to start in THIS process (created by
 * createRun/retryRun). Used to distinguish a fresh run (drive it) from a run
 * left "streaming" in the DB by a since-restarted process (stale → cleanup).
 */
const reservedRuns = new Set<string>();

function runKey(projectId: string, runId: string) {
  return `${projectId}:${runId}`;
}

export function reserveRunProducer(projectId: string, runId: string) {
  reservedRuns.add(runKey(projectId, runId));
}

export function consumeRunReservation(projectId: string, runId: string): boolean {
  const key = runKey(projectId, runId);
  const had = reservedRuns.has(key);
  reservedRuns.delete(key);
  return had;
}

export function getOrCreateRunHub(projectId: string, runId: string): RunHub {
  const key = runKey(projectId, runId);
  let hub = runHubs.get(key);
  if (!hub) {
    hub = {
      runId,
      subscribers: new Set(),
      buffer: [],
      abortController: new AbortController(),
      producerClaimed: false,
      terminal: false,
    };
    runHubs.set(key, hub);
  }
  return hub;
}

export function getRunHub(projectId: string, runId: string): RunHub | undefined {
  return runHubs.get(runKey(projectId, runId));
}

/**
 * Returns true only for the first caller — that caller owns the orchestrator loop.
 */
export function claimRunProducer(projectId: string, runId: string): boolean {
  const hub = getOrCreateRunHub(projectId, runId);
  if (hub.producerClaimed) return false;
  hub.producerClaimed = true;
  return true;
}

export function getRunAbortSignal(projectId: string, runId: string): AbortSignal {
  return getOrCreateRunHub(projectId, runId).abortController.signal;
}

export function publishRunEvent(projectId: string, runId: string, event: RunStreamEvent) {
  const hub = getOrCreateRunHub(projectId, runId);
  hub.buffer.push(event);
  for (const subscriber of hub.subscribers) {
    try {
      subscriber(event);
    } catch {
      // a broken subscriber must not break fan-out to the others
    }
  }
  if (event.type === "run.completed" || event.type === "run.failed" || event.type === "run.stopped") {
    hub.terminal = true;
  }
}

/**
 * Subscribe to a run. Immediately replays the buffered events (so late joiners
 * see the whole run), then receives live events. Returns an unsubscribe fn.
 */
export function subscribeRun(
  projectId: string,
  runId: string,
  enqueue: (event: RunStreamEvent) => void,
): () => void {
  const hub = getOrCreateRunHub(projectId, runId);
  for (const event of hub.buffer) {
    enqueue(event);
  }
  hub.subscribers.add(enqueue);
  return () => {
    hub.subscribers.delete(enqueue);
  };
}

/**
 * Explicit stop. Aborts the orchestrator loop for this run. Idempotent — calling
 * on an already-terminal/absent run is a no-op.
 */
export function abortRun(projectId: string, runId: string): boolean {
  const hub = runHubs.get(runKey(projectId, runId));
  if (!hub) return false;
  hub.abortController.abort();
  return true;
}

export function isRunActive(projectId: string, runId: string): boolean {
  const hub = runHubs.get(runKey(projectId, runId));
  return Boolean(hub) && !hub!.terminal;
}

/**
 * Drop the hub once the run is terminal and all subscribers have left. Called
 * after a subscriber disconnects so memory is reclaimed for finished runs.
 */
export function disposeRunHubIfDone(projectId: string, runId: string) {
  const key = runKey(projectId, runId);
  const hub = runHubs.get(key);
  if (hub && hub.terminal && hub.subscribers.size === 0) {
    runHubs.delete(key);
  }
}

// --- Runtime channel (project-level, multi-subscriber) -------------------

type RuntimeHub = {
  projectId: string;
  subscribers: Set<(event: RuntimeStreamEvent) => void>;
  snapshot: RuntimeStreamEvent | null;
};

const runtimeHubs = new Map<string, RuntimeHub>();

function getOrCreateRuntimeHub(projectId: string): RuntimeHub {
  let hub = runtimeHubs.get(projectId);
  if (!hub) {
    hub = { projectId, subscribers: new Set(), snapshot: null };
    runtimeHubs.set(projectId, hub);
  }
  return hub;
}

export function publishRuntimeEvent(projectId: string, event: RuntimeStreamEvent) {
  const hub = getOrCreateRuntimeHub(projectId);
  if (event.type !== "heartbeat" && event.type !== "preview_reload_requested") {
    hub.snapshot = event;
  }
  for (const subscriber of hub.subscribers) {
    try {
      subscriber(event);
    } catch {
      // ignore broken subscriber
    }
  }
}

/**
 * Publishes a runtime event after a delay. Used for preview start/stop so the
 * server pushes the event only after the PM2 process has had time to settle
 * (spawn + health check), avoiding a race where the client sees the event
 * before the process is actually reachable.
 */
export function scheduleDelayedRuntimeEvent(
  projectId: string,
  event: RuntimeStreamEvent,
  delayMs: number,
): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    publishRuntimeEvent(projectId, event);
  }, delayMs);
}

export function subscribeRuntime(
  projectId: string,
  enqueue: (event: RuntimeStreamEvent) => void,
): () => void {
  const hub = getOrCreateRuntimeHub(projectId);
  if (hub.snapshot) enqueue(hub.snapshot);
  hub.subscribers.add(enqueue);
  return () => {
    hub.subscribers.delete(enqueue);
    if (hub.subscribers.size === 0 && !hub.snapshot) {
      runtimeHubs.delete(projectId);
    }
  };
}

// --- SSE serialization helpers -------------------------------------------

export function getProjectRunStreamUrl(projectId: string, runId: string) {
  return `/api/projects/${encodeURIComponent(projectId)}/runs/${encodeURIComponent(runId)}/stream`;
}

export function getProjectRuntimeStreamUrl(projectId: string) {
  return `/api/projects/${encodeURIComponent(projectId)}/runtime/stream`;
}

export function createMessageStreamHeaders() {
  return {
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
    "X-Accel-Buffering": "no",
  };
}

export function serializeRunStreamEvent(event: RunStreamEvent | RuntimeStreamEvent) {
  const safeEvent = redactJson(event);
  return `event: ${safeEvent.type}\ndata: ${JSON.stringify(safeEvent)}\n\n`;
}

export function encodeRunStreamEvent(event: RunStreamEvent | RuntimeStreamEvent) {
  return textEncoder.encode(serializeRunStreamEvent(event));
}
