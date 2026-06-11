import { describe, expect, it } from "vitest";
import {
  emitRunStarted,
  translateBuilderEventToRunStreamEvent,
} from "@/server/services/builder-run-translator.server";
import type { BuilderRunEvent } from "@/features/agents/ui/builder-events";

const ctx = { runId: "r", projectId: "p", locale: "vi" as const };

describe("US5 — skill_clarification renders distinct from design_variant", () => {
  it("awaiting_clarification with no metadata.questionType falls back to agent_question", () => {
    const out = translateBuilderEventToRunStreamEvent(
      {
        type: "awaiting_clarification",
        runId: "r",
        milestone: "awaiting_clarification",
        question: "Bạn muốn skill nào?",
        options: [
          { id: "a", label: "Skill A" },
          { id: "b", label: "Skill B" },
        ],
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
      messageId: "msg-r-question",
      question: "Bạn muốn skill nào?",
      options: [
        { id: "a", label: "Skill A" },
        { id: "b", label: "Skill B" },
      ],
      metadata: null,
    });
    expect(out.terminal).toBe("awaiting_input");
  });

  it("awaiting_clarification with skill_clarification metadata persists distinct payload", () => {
    const out = translateBuilderEventToRunStreamEvent(
      {
        type: "awaiting_clarification",
        runId: "r",
        milestone: "awaiting_clarification",
        question: "Chọn một skill phù hợp",
        options: [
          { id: "design-taste-frontend", label: "Design taste frontend" },
          { id: "minimalist-ui", label: "Minimalist UI" },
        ],
        metadata: {
          questionType: "skill_clarification",
          options: [
            { id: "design-taste-frontend", label: "Design taste frontend" },
            { id: "minimalist-ui", label: "Minimalist UI" },
          ],
          customAnswerAllowed: false,
        },
        at: 0,
      },
      ctx,
    );
    // The translator surfaces a message_created + awaiting_input — the UI
    // dispatches by metadata.questionType (asserted in MessageBubble layer).
    expect(out.events[0]).toMatchObject({
      type: "message.created",
      kind: "agent_question",
      content: "Chọn một skill phù hợp",
    });
    expect(out.persist).toMatchObject({
      kind: "agent_question",
      options: [
        { id: "design-taste-frontend", label: "Design taste frontend" },
        { id: "minimalist-ui", label: "Minimalist UI" },
      ],
    });
  });

  it("end-to-end SSE sequence for a skill clarification answers cleanly with run.completed", () => {
    const events: BuilderRunEvent[] = [
      { type: "milestone", runId: "r", milestone: "loading_context", at: 0 },
      {
        type: "awaiting_clarification",
        runId: "r",
        milestone: "awaiting_clarification",
        question: "Chọn một skill phù hợp",
        options: [
          { id: "design-taste-frontend", label: "Design taste frontend" },
        ],
        metadata: {
          questionType: "skill_clarification",
          options: [
            { id: "design-taste-frontend", label: "Design taste frontend" },
          ],
          customAnswerAllowed: false,
        },
        at: 1,
      },
    ];
    const flat = [emitRunStarted(ctx)];
    for (const e of events) {
      const r = translateBuilderEventToRunStreamEvent(e, ctx);
      flat.push(...r.events);
    }
    expect(flat.map((e) => e.type)).toEqual([
      "run.started",
      "skeleton.update",
      "message.created",
      "run.awaiting_input",
    ]);
  });
});
