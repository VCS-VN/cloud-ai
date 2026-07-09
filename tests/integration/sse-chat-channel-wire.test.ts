/**
 * End-to-end SSE wire format test (T014).
 *
 * Proves that when the codex driver emits BuilderRunEvent values into a
 * BuilderRunHandle, the chat-event-channel surfaces RunStreamEvent values to
 * SSE consumers — not the raw BuilderRunEvent shape.
 *
 * Without this guarantee, the frontend reducer (chatStateReducer) drops every
 * event in the default case, the chat panel stays empty, and the UI can only
 * see the project's processing flag from REST polling.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  publishChatEvent,
  resetChatChannelsForTest,
  subscribeChatEvents,
} from "@/server/services/chat-event-channel.server";
import {
  emitRunStarted,
  translateBuilderEventToRunStreamEvent,
} from "@/server/services/builder-run-translator.server";
import type { BuilderRunEvent } from "@/features/agents/ui/builder-events";
import type { RunStreamEvent } from "@/shared/project-types";
import { buildArchivedReplay } from "@/routes/api/projects/$projectId/builder-runs/$runId/stream";
import { reconcileArchivedReplayProjectState } from "@/routes/api/projects/$projectId/builder-runs/$runId/stream";

const RUN_ID = "run-2A-test";
const PROJECT_ID = "p-1";

beforeEach(() => {
  resetChatChannelsForTest();
});

afterEach(() => {
  resetChatChannelsForTest();
});

function bridgePublish(event: BuilderRunEvent): void {
  const ctx = { runId: RUN_ID, projectId: PROJECT_ID, locale: "vi" as const };
  const outcome = translateBuilderEventToRunStreamEvent(event, ctx);
  for (const e of outcome.events) publishChatEvent(RUN_ID, e);
}

describe("Phase 5 (option 2A) — chat-event-channel end-to-end SSE wire", () => {
  it("emits RunStreamEvent shape (NOT BuilderRunEvent) to subscribers", () => {
    const received: RunStreamEvent[] = [];
    publishChatEvent(RUN_ID, emitRunStarted({ runId: RUN_ID, projectId: PROJECT_ID, locale: "vi" }));
    bridgePublish({ type: "milestone", runId: RUN_ID, milestone: "loading_context", at: 1 });

    const sub = subscribeChatEvents(RUN_ID, (e) => received.push(e));
    sub.unsubscribe();

    // Subscriber gets a *replay* of all buffered events first.
    const types = received.map((e) => e.type);
    expect(types).toEqual(["run.started", "skeleton.update"]);
    // Critical: BuilderRunEvent types ("milestone", "done", "failed") must NOT appear.
    expect(types).not.toContain("milestone");
    expect(types).not.toContain("done");
    expect(types).not.toContain("failed");
  });

  it("translates the full driver lifecycle into RunStreamEvent sequence", () => {
    const events: BuilderRunEvent[] = [
      { type: "milestone", runId: RUN_ID, milestone: "loading_context", at: 0 },
      { type: "milestone", runId: RUN_ID, milestone: "planning", at: 1 },
      { type: "milestone", runId: RUN_ID, milestone: "creating_draft", at: 2 },
      { type: "file_change", runId: RUN_ID, path: "src/routes/index.tsx", at: 3 },
      { type: "milestone", runId: RUN_ID, milestone: "building_pages", at: 4 },
      { type: "turn_completed", runId: RUN_ID, finalResponse: "Đã hoàn tất.", at: 5 },
      { type: "milestone", runId: RUN_ID, milestone: "publishing", at: 6 },
      { type: "done", runId: RUN_ID, milestone: "done", at: 7 },
    ];
    publishChatEvent(RUN_ID, emitRunStarted({ runId: RUN_ID, projectId: PROJECT_ID, locale: "vi" }));
    for (const e of events) bridgePublish(e);

    const captured: RunStreamEvent[] = [];
    subscribeChatEvents(RUN_ID, (e) => captured.push(e));

    const types = captured.map((e) => e.type);
    expect(types[0]).toBe("run.started");
    expect(types).toContain("skeleton.update");
    expect(types).toContain("message.created");
    expect(types).toContain("message.completed");
    expect(types[types.length - 1]).toBe("run.completed");
  });

  it("translates failed → run.failed with friendly Vietnamese message", () => {
    bridgePublish({
      type: "failed",
      runId: RUN_ID,
      milestone: "failed",
      failureCode: "required_skill_unavailable",
      message: "(internal) skill design-taste-frontend not registered",
      at: 1,
    });

    const captured: RunStreamEvent[] = [];
    subscribeChatEvents(RUN_ID, (e) => captured.push(e));
    const failed = captured.find((e) => e.type === "run.failed") as
      | { error: { message: string } }
      | undefined;
    expect(failed).toBeDefined();
    // Friendly message MUST not leak the raw cause.
    expect(failed!.error.message).not.toContain("design-taste-frontend");
    expect(failed!.error.message).not.toContain("internal");
    // It SHOULD be the Vietnamese friendly copy.
    expect(failed!.error.message).toContain("hướng dẫn");
  });

  it("late subscriber gets a one-shot replay of all buffered events including terminal", () => {
    bridgePublish({ type: "milestone", runId: RUN_ID, milestone: "loading_context", at: 0 });
    bridgePublish({ type: "done", runId: RUN_ID, milestone: "done", at: 1 });

    const captured: RunStreamEvent[] = [];
    const sub = subscribeChatEvents(RUN_ID, (e) => captured.push(e));

    expect(sub.terminal).toBe(true);
    expect(captured.map((e) => e.type)).toEqual(["skeleton.update", "run.completed"]);
  });

  it("live subscriber receives events as they arrive", () => {
    const captured: RunStreamEvent[] = [];
    subscribeChatEvents(RUN_ID, (e) => captured.push(e));

    bridgePublish({ type: "milestone", runId: RUN_ID, milestone: "loading_context", at: 0 });
    bridgePublish({ type: "milestone", runId: RUN_ID, milestone: "planning", at: 1 });
    bridgePublish({ type: "done", runId: RUN_ID, milestone: "done", at: 2 });

    const types = captured.map((e) => e.type);
    expect(types.filter((t) => t === "skeleton.update").length).toBeGreaterThanOrEqual(2);
    expect(types[types.length - 1]).toBe("run.completed");
  });

  it("a plan.todo_updated BuilderRunEvent surfaces on the wire and persists a todo_snapshot", () => {
    const items = [
      { id: "t1", text: "Build hero", completed: false },
      { id: "t2", text: "Validate preview", completed: false },
    ];
    // Translator side: the event carries through to the SSE channel and yields
    // a todo_snapshot timeline directive for persistence.
    const outcome = translateBuilderEventToRunStreamEvent(
      { type: "plan.todo_updated", runId: RUN_ID, items, at: 42 },
      { runId: RUN_ID, projectId: PROJECT_ID, locale: "vi" },
    );
    expect(outcome.timeline).toEqual({ kind: "todo_snapshot", items });

    const captured: RunStreamEvent[] = [];
    subscribeChatEvents(RUN_ID, (e) => captured.push(e));
    bridgePublish({ type: "plan.todo_updated", runId: RUN_ID, items, at: 42 });

    const todo = captured.find((e) => e.type === "plan.todo_updated") as
      | (RunStreamEvent & { items: unknown; at: number })
      | undefined;
    expect(todo).toBeDefined();
    expect(todo!.items).toEqual(items);
    expect(todo!.at).toBe(42);
  });
});

async function readSseEvents(stream: ReadableStream<Uint8Array>): Promise<RunStreamEvent[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events: RunStreamEvent[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
  }
  buffer += decoder.decode();
  for (const block of buffer.split("\n\n")) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const dataLine = trimmed.split("\n").find((l) => l.startsWith("data:"));
    if (!dataLine) continue;
    events.push(JSON.parse(dataLine.slice(5).trim()) as RunStreamEvent);
  }
  return events;
}

describe("buildArchivedReplay — deterministic single-summary replay", () => {
  it("emits only the last summary with msg-${runId}-answer id", async () => {
    const stream = buildArchivedReplay(RUN_ID, {
      status: "completed",
      progressTimeline: [
        { at: 1, kind: "summary", text: "interim batch summary 1" },
        { at: 2, kind: "summary", text: "interim batch summary 2" },
        { at: 3, kind: "summary", text: "final answer" },
      ],
    });
    const events = await readSseEvents(stream);
    const created = events.filter((e) => e.type === "message.created") as Array<
      RunStreamEvent & { messageId: string; content: string }
    >;
    expect(created).toHaveLength(1);
    expect(created[0].messageId).toBe(`msg-${RUN_ID}-answer`);
    expect(created[0].content).toBe("final answer");
    expect(events[events.length - 1].type).toBe("run.completed");
  });

  it("re-emits todo_snapshot timeline entries as plan.todo_updated alongside the single summary", async () => {
    const early = [
      { id: "t1", text: "Build hero", completed: false },
      { id: "t2", text: "Validate preview", completed: false },
    ];
    const late = [
      { id: "t1", text: "Build hero", completed: true },
      { id: "t2", text: "Validate preview", completed: false },
    ];
    const stream = buildArchivedReplay(RUN_ID, {
      status: "completed",
      progressTimeline: [
        { at: 0, kind: "todo_snapshot", items: early },
        { at: 2, kind: "summary", text: "intermediate" },
        { at: 3, kind: "todo_snapshot", items: late },
        { at: 4, kind: "summary", text: "final" },
      ],
    });
    const events = await readSseEvents(stream);
    const types = events.map((e) => e.type);
    const todoEvents = events.filter(
      (e) => e.type === "plan.todo_updated",
    ) as Array<RunStreamEvent & { items: unknown; at: number }>;
    expect(todoEvents).toHaveLength(2);
    expect(todoEvents[0].items).toEqual(early);
    expect(todoEvents[0].at).toBe(0);
    expect(todoEvents[1].items).toEqual(late);
    expect(todoEvents[1].at).toBe(3);
    expect(types.filter((t) => t === "message.created")).toHaveLength(1);
  });

  it("emits no message.created when no summary exists in the timeline", async () => {
    const stream = buildArchivedReplay(RUN_ID, {
      status: "failed",
      progressTimeline: [{ at: 0, kind: "error", failureCode: "preview_failed" }],
    });
    const events = await readSseEvents(stream);
    expect(events.filter((e) => e.type === "message.created")).toHaveLength(0);
    expect(events[events.length - 1].type).toBe("run.failed");
  });
});

describe("reconcileArchivedReplayProjectState", () => {
  it("clears project processing for already-terminal archived runs", async () => {
    const updateProjectProcessingState = vi.fn().mockResolvedValue({
      id: PROJECT_ID,
      processingStatus: "idle",
    });

    await reconcileArchivedReplayProjectState({
      projectRepository: { updateProjectProcessingState },
      projectId: PROJECT_ID,
      runId: RUN_ID,
      userId: "user-1",
      runStatus: "completed",
    });

    expect(updateProjectProcessingState).toHaveBeenCalledWith(
      PROJECT_ID,
      "idle",
      "user-1",
    );
  });

  it("clears project processing for stranded live statuses replayed as terminal", async () => {
    const updateProjectProcessingState = vi.fn().mockResolvedValue({
      id: PROJECT_ID,
      processingStatus: "idle",
    });

    await reconcileArchivedReplayProjectState({
      projectRepository: { updateProjectProcessingState },
      projectId: PROJECT_ID,
      runId: RUN_ID,
      userId: "user-1",
      runStatus: "streaming",
    });

    expect(updateProjectProcessingState).toHaveBeenCalledWith(
      PROJECT_ID,
      "idle",
      "user-1",
    );
  });
});
