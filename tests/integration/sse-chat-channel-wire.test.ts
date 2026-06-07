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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
});
