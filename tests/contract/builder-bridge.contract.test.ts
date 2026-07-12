import { describe, expect, it } from "vitest";
import {
  emitRunStarted,
  translateBuilderEventToRunStreamEvent,
} from "@/server/services/builder-run-translator.server";
import type { BuilderRunEvent } from "@/features/agents/ui/builder-events";
import type { RunStreamEvent } from "@/shared/project-types";

const ctx = { runId: "run-1", projectId: "proj-1", locale: "vi" as const };

function flattenEvents(events: BuilderRunEvent[]): RunStreamEvent[] {
  const out: RunStreamEvent[] = [emitRunStarted(ctx)];
  for (const e of events) {
    const r = translateBuilderEventToRunStreamEvent(e, ctx);
    out.push(...r.events);
  }
  return out;
}

describe("BuilderRunEvent → RunStreamEvent translator (Phase 1 contract)", () => {
  it("milestone(loading_context) emits skeleton.update(understanding) with vi label", () => {
    const out = translateBuilderEventToRunStreamEvent(
      { type: "milestone", runId: "run-1", milestone: "loading_context", at: 0 },
      ctx,
    );
    expect(out.events).toEqual([
      {
        type: "skeleton.update",
        runId: "run-1",
        phase: "understanding",
        label: "Đang đọc cấu trúc trang",
      },
    ]);
    expect(out.timeline).toEqual({ kind: "milestone", milestone: "loading_context" });
    expect(out.terminal).toBeNull();
  });

  it("file_change(home page) emits a section-framed editing skeleton", () => {
    const out = translateBuilderEventToRunStreamEvent(
      { type: "file_change", runId: "run-1", path: "src/routes/index.tsx", at: 0 },
      ctx,
    );
    expect(out.events).toEqual([
      {
        type: "skeleton.update",
        runId: "run-1",
        phase: "editing",
        label: "Đang cập nhật trang chủ",
      },
    ]);
  });

  it("file_change(unmapped path) suppresses the event entirely (FR-007)", () => {
    const out = translateBuilderEventToRunStreamEvent(
      { type: "file_change", runId: "run-1", path: "src/server/util.ts", at: 0 },
      ctx,
    );
    expect(out.events).toEqual([]);
    expect(out.timeline).toBeNull();
  });

  it("turn_completed emits a privacy-safe answer message + completed", () => {
    const out = translateBuilderEventToRunStreamEvent(
      {
        type: "turn_completed",
        runId: "run-1",
        finalResponse: "Đã thêm ảnh vào phần hero ở trang chủ.",
        at: 1234,
      },
      ctx,
    );
    expect(out.events).toHaveLength(2);
    expect(out.events[0]).toMatchObject({
      type: "message.created",
      kind: "answer",
      content: "Đã thêm ảnh vào phần hero ở trang chủ.",
    });
    expect(out.events[1]).toMatchObject({
      type: "message.completed",
      content: "Đã thêm ảnh vào phần hero ở trang chủ.",
    });
    expect(out.persist).toEqual({
      kind: "answer",
      messageId: "msg-run-1-answer",
      content: "Đã thêm ảnh vào phần hero ở trang chủ.",
      processingStatus: "completed",
    });
  });

  it("turn_completed strips a finalResponse sentence that leaks a file path, falling back to the safe default", () => {
    const raw = "Updated src/components/storefront/Hero.tsx successfully";
    const out = translateBuilderEventToRunStreamEvent(
      {
        type: "turn_completed",
        runId: "run-1",
        finalResponse: raw,
        at: 1234,
      },
      ctx,
    );
    expect(out.events[0]).toMatchObject({ content: "Đã hoàn tất yêu cầu của bạn." });
    expect(out.persist).toMatchObject({ content: "Đã hoàn tất yêu cầu của bạn." });
  });

  it("turn_completed keeps plain-language sentences verbatim alongside a leaking sentence, dropping only the unsafe one", () => {
    const out = translateBuilderEventToRunStreamEvent(
      {
        type: "turn_completed",
        runId: "run-1",
        finalResponse:
          "Đã thêm ảnh mới vào phần hero. Updated product?.defaultModel?.price for the sale.",
        at: 1234,
      },
      ctx,
    );
    expect(out.events[0]).toMatchObject({ content: "Đã thêm ảnh mới vào phần hero." });
  });

  it("turn_completed falls back to the safe default only when finalResponse is empty", () => {
    const out = translateBuilderEventToRunStreamEvent(
      { type: "turn_completed", runId: "run-1", finalResponse: "   ", at: 1234 },
      ctx,
    );
    expect(out.events[0]).toMatchObject({ content: "Đã hoàn tất yêu cầu của bạn." });
  });

  it("turn_completed with runKind+changedFiles prepends a section-aware headline while keeping finalResponse verbatim", () => {
    const out = translateBuilderEventToRunStreamEvent(
      {
        type: "turn_completed",
        runId: "run-1",
        finalResponse: "Đã thêm ảnh mới.",
        runKind: "update",
        changedFiles: ["src/components/storefront/Hero.tsx"],
        at: 1234,
      },
      ctx,
    );
    expect(out.events[0]).toMatchObject({ content: expect.stringContaining("phần hero") });
    expect(out.events[0]).toMatchObject({
      content: expect.stringContaining("Đã thêm ảnh mới."),
    });
  });

  it("thinking emits a skeleton.update AND a persisted reasoning message, stripped of code leaks", () => {
    const raw = "Reading src/routes/index.tsx to plan the hero edit";
    const out = translateBuilderEventToRunStreamEvent(
      { type: "thinking", runId: "run-1", text: raw, at: 55 },
      ctx,
    );
    expect(out.events.map((e) => e.type)).toEqual([
      "skeleton.update",
      "message.created",
      "message.completed",
    ]);
    expect(out.events[1]).toMatchObject({
      kind: "reasoning",
      content: "Đã hoàn tất yêu cầu của bạn.",
    });
    expect(out.persist).toEqual({
      kind: "reasoning",
      messageId: "msg-run-1-reasoning-55",
      content: "Đã hoàn tất yêu cầu của bạn.",
      processingStatus: "completed",
    });
  });

  it("thinking keeps a plain-language sentence verbatim when it contains no code leak", () => {
    const raw = "Mình đang xem lại cấu trúc trang chủ để lên phương án chỉnh sửa.";
    const out = translateBuilderEventToRunStreamEvent(
      { type: "thinking", runId: "run-1", text: raw, at: 55 },
      ctx,
    );
    expect(out.events[1]).toMatchObject({ kind: "reasoning", content: raw });
  });

  it("agent_message emits a persisted agent_message message, stripped of code leaks", () => {
    const raw = "I edited `Hero.tsx` and added the promo banner.";
    const out = translateBuilderEventToRunStreamEvent(
      { type: "agent_message", runId: "run-1", text: raw, at: 77 },
      ctx,
    );
    expect(out.events.map((e) => e.type)).toEqual([
      "message.created",
      "message.completed",
    ]);
    expect(out.events[0]).toMatchObject({
      kind: "agent_message",
      content: "Đã hoàn tất yêu cầu của bạn.",
    });
    expect(out.persist).toEqual({
      kind: "agent_message",
      messageId: "msg-run-1-agent-77",
      content: "Đã hoàn tất yêu cầu của bạn.",
      processingStatus: "completed",
    });
  });

  it("agent_message keeps a plain-language sentence verbatim, dropping only a code-identifier leak in the same text", () => {
    const raw = "Đã cập nhật giá sản phẩm. This calls updateItemQuantity internally.";
    const out = translateBuilderEventToRunStreamEvent(
      { type: "agent_message", runId: "run-1", text: raw, at: 77 },
      ctx,
    );
    expect(out.events[0]).toMatchObject({
      kind: "agent_message",
      content: "Đã cập nhật giá sản phẩm.",
    });
  });

  it("done → run.completed terminal", () => {
    const out = translateBuilderEventToRunStreamEvent(
      { type: "done", runId: "run-1", milestone: "done", at: 0 },
      ctx,
    );
    expect(out.events).toEqual([
      { type: "run.completed", runId: "run-1", projectProcessingStatus: "idle" },
    ]);
    expect(out.terminal).toBe("completed");
  });

  it("failed → run.failed with friendly vi message + persist error", () => {
    const out = translateBuilderEventToRunStreamEvent(
      {
        type: "failed",
        runId: "run-1",
        milestone: "failed",
        failureCode: "preview_failed",
        message: "(internal) preview did not bind to port",
        at: 0,
      },
      ctx,
    );
    expect(out.events[0]).toMatchObject({
      type: "run.failed",
      error: {
        code: "PROVIDER_STREAM_FAILED",
        message: "Preview chưa lên được. Hãy thử lại.",
      },
    });
    expect(out.persist).toEqual({
      kind: "error",
      messageId: "msg-run-1-error",
      content: "Preview chưa lên được. Hãy thử lại.",
      failureCode: "preview_failed",
    });
    expect(out.timeline).toEqual({ kind: "error", failureCode: "preview_failed" });
    expect(out.terminal).toBe("failed");
  });

  it("cancelled → run.stopped terminal", () => {
    const out = translateBuilderEventToRunStreamEvent(
      { type: "cancelled", runId: "run-1", milestone: "cancelled", at: 0 },
      ctx,
    );
    expect(out.events).toEqual([
      { type: "run.stopped", runId: "run-1", projectProcessingStatus: "idle" },
    ]);
    expect(out.terminal).toBe("stopped");
  });

  it("awaiting_clarification → message.created(agent_question) + run.awaiting_input", () => {
    const out = translateBuilderEventToRunStreamEvent(
      {
        type: "awaiting_clarification",
        runId: "run-1",
        milestone: "awaiting_clarification",
        question: "Bạn muốn skill nào?",
        options: [{ id: "a", label: "Skill A" }],
        at: 0,
      },
      ctx,
    );
    expect(out.events.map((e) => e.type)).toEqual([
      "message.created",
      "run.awaiting_input",
    ]);
    expect(out.persist).toEqual({
      kind: "agent_question",
      messageId: "msg-run-1-question",
      question: "Bạn muốn skill nào?",
      options: [{ id: "a", label: "Skill A" }],
      metadata: null,
    });
    expect(out.terminal).toBe("awaiting_input");
  });

  it("end-to-end scripted hero-update sequence matches the contract shape", () => {
    const scripted: BuilderRunEvent[] = [
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
        finalResponse: "Đã thêm ảnh vào phần hero.",
        at: 2,
      },
      { type: "done", runId: "run-1", milestone: "done", at: 3 },
    ];
    const flat = flattenEvents(scripted);
    const types = flat.map((e) => e.type);
    expect(types).toEqual([
      "run.started",
      "skeleton.update", // loading_context
      "skeleton.update", // section update from file_change
      "message.created", // β-lite answer
      "message.completed",
      "run.completed",
    ]);
  });
});
