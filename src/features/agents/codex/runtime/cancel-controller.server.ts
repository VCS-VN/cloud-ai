import {
  getBuilderRunHandle,
  publishBuilderRunEvent,
} from "./builder-run-registry.server";

export type CancelOutcome =
  | { ok: true; alreadyCancelled?: boolean }
  | { ok: false; reason: "not_found" | "forbidden" | "already_terminal" };

export function cancelBuilderRun(input: {
  runId: string;
  userId: string | undefined;
}): CancelOutcome {
  const handle = getBuilderRunHandle(input.runId);
  if (!handle) return { ok: false, reason: "not_found" };
  if (handle.userId && handle.userId !== input.userId) {
    return { ok: false, reason: "forbidden" };
  }
  if (
    handle.status === "done" ||
    handle.status === "failed" ||
    handle.status === "cancelled"
  ) {
    return { ok: false, reason: "already_terminal" };
  }
  if (handle.abortController.signal.aborted) {
    return { ok: true, alreadyCancelled: true };
  }
  handle.abortController.abort();
  publishBuilderRunEvent(handle, {
    type: "cancelled",
    runId: handle.runId,
    milestone: "cancelled",
    at: Date.now(),
  });
  return { ok: true };
}
