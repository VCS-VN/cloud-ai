import { describe, expect, it } from "vitest";
import { runBuilderBridge } from "@/server/services/builder-run-bridge.server";
import type { BuilderRunEvent } from "@/features/agents/ui/builder-events";
import type { RunStreamEvent } from "@/shared/project-types";

async function* asAsync<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield item;
}

type SavedMessage = {
  kind: "answer" | "error" | "agent_question" | "plan";
  content: string;
};

type TimelineRecord = { kind: string; payload: unknown };

function makeAdapter() {
  const messages: SavedMessage[] = [];
  const timeline: TimelineRecord[] = [];
  const statuses: Array<{ terminal: string; failureCode?: string }> = [];
  return {
    messages,
    timeline,
    statuses,
    saveAgentMessage: async (i: {
      kind: SavedMessage["kind"];
      content: string;
    }) => {
      messages.push({ kind: i.kind, content: i.content });
    },
    appendProgressTimeline: async (i: { event: unknown }) => {
      timeline.push({ kind: (i.event as { kind: string }).kind, payload: i.event });
    },
    setRunStatus: async (i: { terminal: string; failureCode?: string }) => {
      statuses.push({ terminal: i.terminal, failureCode: i.failureCode });
    },
  };
}

describe("US1 — runBuilderBridge end-to-end (hero image update)", () => {
  it("emits expected SSE sequence and persists β-lite answer + progress timeline", async () => {
    const adapter = makeAdapter();
    const emitted: RunStreamEvent[] = [];
    const events: BuilderRunEvent[] = [
      { type: "milestone", runId: "run-1", milestone: "loading_context", at: 0 },
      {
        type: "file_change",
        runId: "run-1",
        path: "src/components/storefront/Hero.tsx",
        at: 1,
      },
      {
        type: "turn_completed",
        runId: "run-1",
        finalResponse: "Đã thêm ảnh vào phần hero ở trang chủ.",
        at: 2,
      },
      { type: "done", runId: "run-1", milestone: "done", at: 3 },
    ];
    const result = await runBuilderBridge({
      ctx: { runId: "run-1", projectId: "proj-1", locale: "vi" },
      events: asAsync(events),
      emit: (e) => emitted.push(e),
      persist: adapter,
    });

    // SSE: run.started → skeleton(understanding) → skeleton(editing-hero) → message.created/completed → run.completed
    expect(emitted.map((e) => e.type)).toEqual([
      "run.started",
      "skeleton.update",
      "skeleton.update",
      "message.created",
      "message.completed",
      "run.completed",
    ]);

    // persisted answer message — kind=answer, β-lite content
    expect(adapter.messages).toHaveLength(1);
    expect(adapter.messages[0]).toEqual({
      kind: "answer",
      content: "Đã thêm ảnh vào phần hero ở trang chủ.",
    });

    // progress timeline received milestone + section + summary entries
    expect(adapter.timeline.map((t) => t.kind)).toEqual([
      "milestone",
      "section",
      "summary",
    ]);

    // terminal status recorded once with the completed kind
    expect(adapter.statuses).toEqual([{ terminal: "completed", failureCode: undefined }]);
    expect(result.terminal).toBe("completed");
  });

  it("suppresses unmapped file_change paths to honor privacy (FR-007)", async () => {
    const adapter = makeAdapter();
    const emitted: RunStreamEvent[] = [];
    const events: BuilderRunEvent[] = [
      { type: "milestone", runId: "run-1", milestone: "loading_context", at: 0 },
      {
        type: "file_change",
        runId: "run-1",
        path: "src/server/internal-thing.ts",
        at: 1,
      },
      { type: "done", runId: "run-1", milestone: "done", at: 2 },
    ];
    await runBuilderBridge({
      ctx: { runId: "run-1", projectId: "proj-1", locale: "vi" },
      events: asAsync(events),
      emit: (e) => emitted.push(e),
      persist: adapter,
    });

    // Only the milestone skeleton is emitted; no editing skeleton appears.
    const skeletonLabels = emitted
      .filter((e) => e.type === "skeleton.update")
      .map((e) => (e as { label: string }).label);
    expect(skeletonLabels).toEqual(["Đang đọc cấu trúc trang"]);

    // Section timeline event is also suppressed.
    expect(adapter.timeline.map((t) => t.kind)).toEqual(["milestone"]);
  });

  it("failed event maps to friendly user copy (no raw error frame leaks)", async () => {
    const adapter = makeAdapter();
    const emitted: RunStreamEvent[] = [];
    const events: BuilderRunEvent[] = [
      {
        type: "failed",
        runId: "run-1",
        milestone: "failed",
        failureCode: "preview_failed",
        message: "(internal) ECONNREFUSED 127.0.0.1:34521",
        at: 0,
      },
    ];
    await runBuilderBridge({
      ctx: { runId: "run-1", projectId: "proj-1", locale: "vi" },
      events: asAsync(events),
      emit: (e) => emitted.push(e),
      persist: adapter,
    });

    const failedEvent = emitted.find((e) => e.type === "run.failed") as
      | { error: { message: string } }
      | undefined;
    expect(failedEvent?.error.message).toBe("Preview chưa lên được. Hãy thử lại.");
    expect(failedEvent?.error.message).not.toContain("ECONNREFUSED");
    expect(adapter.messages[0]).toEqual({
      kind: "error",
      content: "Preview chưa lên được. Hãy thử lại.",
    });
    expect(adapter.statuses[0]).toEqual({
      terminal: "failed",
      failureCode: "preview_failed",
    });
  });

  it("clarification event records agent_question + flags awaiting_input terminal", async () => {
    const adapter = makeAdapter();
    const emitted: RunStreamEvent[] = [];
    const events: BuilderRunEvent[] = [
      {
        type: "awaiting_clarification",
        runId: "run-1",
        milestone: "awaiting_clarification",
        question: "Bạn muốn skill nào?",
        options: [
          { id: "a", label: "Skill A" },
          { id: "b", label: "Skill B" },
        ],
        at: 0,
      },
    ];
    const result = await runBuilderBridge({
      ctx: { runId: "run-1", projectId: "proj-1", locale: "vi" },
      events: asAsync(events),
      emit: (e) => emitted.push(e),
      persist: adapter,
    });

    expect(adapter.messages[0]).toEqual({
      kind: "agent_question",
      content: "Bạn muốn skill nào?",
    });
    expect(emitted.some((e) => e.type === "run.awaiting_input")).toBe(true);
    expect(result.terminal).toBe("awaiting_input");
  });
});
