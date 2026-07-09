import { describe, expect, it } from "vitest";
import { translateBuilderEventToRunStreamEvent } from "@/server/services/builder-run-translator.server";

const CTX = { runId: "r1", projectId: "p1", locale: "en" as const };

describe("translator: todo event pass-through", () => {
  it("plan.todo_updated emits the SSE event and persists a todo_snapshot timeline", () => {
    const items = [
      { id: "a", text: "Analyze brand", completed: true },
      { id: "b", text: "Build the home page", completed: false },
      { id: "c", text: "Validate the preview", completed: false },
    ];
    const out = translateBuilderEventToRunStreamEvent(
      { type: "plan.todo_updated", runId: "r1", items, at: 1000 },
      CTX,
    );
    expect(out.events).toHaveLength(1);
    expect(out.events[0]).toEqual({
      type: "plan.todo_updated",
      runId: "r1",
      items,
      at: 1000,
    });
    expect(out.timeline).toEqual({ kind: "todo_snapshot", items });
    expect(out.terminal).toBeNull();
    expect(out.persist).toBeNull();
  });

  it("a later plan.todo_updated carries the new item set through unchanged", () => {
    const items = [
      { id: "a", text: "Analyze brand", completed: true },
      { id: "b", text: "Build the home page", completed: true },
    ];
    const out = translateBuilderEventToRunStreamEvent(
      { type: "plan.todo_updated", runId: "r1", items, at: 5000 },
      CTX,
    );
    expect(out.events[0]).toMatchObject({
      type: "plan.todo_updated",
      runId: "r1",
      items,
      at: 5000,
    });
    expect(out.timeline).toEqual({ kind: "todo_snapshot", items });
  });

  it("repairing milestone emits no todo timeline", () => {
    const out = translateBuilderEventToRunStreamEvent(
      { type: "milestone", runId: "r1", milestone: "repairing", at: 6000 },
      CTX,
    );
    expect(out.timeline).toEqual({ kind: "milestone", milestone: "repairing" });
    // Translator stays milestone-shaped; task transitions are fired by the
    // driver's helpers, not by the translator.
  });
});

describe("translator: agent_question metadata pass-through", () => {
  it("design_variant clarification carries options to FE event + persist", () => {
    const variants = [
      {
        id: "minimal",
        label: "Minimal",
        description: "Tối giản",
        preview: {
          font: "Inter",
          palette: ["#fff", "#000", "#ccc"],
          motion: 0.2,
        },
      },
      {
        id: "warm",
        label: "Warm",
        description: "Ấm áp",
        preview: {
          font: "Lora",
          palette: ["#fdf6ec", "#a05a2c", "#5e3a1d"],
          motion: 0.4,
        },
      },
    ];
    const out = translateBuilderEventToRunStreamEvent(
      {
        type: "awaiting_clarification",
        runId: "r1",
        milestone: "awaiting_clarification",
        question: "Chọn phong cách thiết kế cho cửa hàng",
        options: variants.map((v) => ({ id: v.id, label: v.label })),
        metadata: {
          questionType: "design_variant",
          options: variants,
          customAnswerAllowed: true,
        },
        at: 1,
      },
      CTX,
    );
    const created = out.events[0] as { metadata: unknown };
    expect(created.metadata).toEqual({
      questionType: "design_variant",
      options: variants,
      selectedOptionId: null,
    });
    expect(out.persist).toMatchObject({
      kind: "agent_question",
      metadata: {
        questionType: "design_variant",
        options: variants,
        selectedOptionId: null,
      },
    });
  });

  it("skill_clarification metadata becomes clarification_options for FE renderer", () => {
    const out = translateBuilderEventToRunStreamEvent(
      {
        type: "awaiting_clarification",
        runId: "r1",
        milestone: "awaiting_clarification",
        question: "Pick a skill",
        options: [
          { id: "minimalist-ui", label: "Minimalist UI" },
          { id: "industrial-brutalist-ui", label: "Industrial Brutalist UI" },
        ],
        metadata: {
          questionType: "skill_clarification",
          options: [
            { id: "minimalist-ui", label: "Minimalist UI" },
            { id: "industrial-brutalist-ui", label: "Industrial Brutalist UI" },
          ],
          customAnswerAllowed: false,
        },
        at: 2,
      },
      CTX,
    );
    const created = out.events[0] as {
      metadata: { questionType: string; options: unknown[] };
    };
    expect(created.metadata.questionType).toBe("clarification_options");
    expect(created.metadata.options).toHaveLength(2);
  });
});
