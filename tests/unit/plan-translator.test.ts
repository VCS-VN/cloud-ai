import { describe, expect, it } from "vitest";
import { estimatePlanTasks, translateBuilderEventToRunStreamEvent } from "@/server/services/builder-run-translator.server";

const CTX = { runId: "r1", projectId: "p1", locale: "en" as const };

describe("translator: plan event pass-through", () => {
  it("plan.created emits the SSE event and persists task_plan timeline", () => {
    const tasks = [
      { id: "a", title: "Analyze brand", phase: "prep" as const },
      { id: "b", title: "Build the home page", phase: "build" as const },
    ];
    const out = translateBuilderEventToRunStreamEvent(
      { type: "plan.created", runId: "r1", tasks, at: 1000 },
      CTX,
    );
    const estimate = estimatePlanTasks(tasks);
    expect(out.events).toHaveLength(1);
    expect(out.events[0]).toMatchObject({
      type: "plan.created",
      runId: "r1",
      tasks,
      estimate,
      at: 1000,
    });
    expect(out.timeline).toEqual({ kind: "task_plan", tasks, estimate });
    expect(out.terminal).toBeNull();
    expect(out.persist).toBeNull();
  });

  it("plan.task.started emits SSE event with re-shape and timeline transition", () => {
    const out = translateBuilderEventToRunStreamEvent(
      { type: "plan.task.started", runId: "r1", taskId: "x", at: 2000 },
      CTX,
    );
    expect(out.events[0]).toEqual({
      type: "plan.task.started",
      runId: "r1",
      taskId: "x",
      at: 2000,
    });
    expect(out.timeline).toEqual({
      kind: "task_transition",
      id: "x",
      transition: "started",
    });
  });

  it("plan.task.completed maps to completed transition", () => {
    const out = translateBuilderEventToRunStreamEvent(
      { type: "plan.task.completed", runId: "r1", taskId: "x", at: 3000 },
      CTX,
    );
    expect(out.timeline).toEqual({
      kind: "task_transition",
      id: "x",
      transition: "completed",
    });
  });

  it("plan.task.paused maps to paused transition", () => {
    const out = translateBuilderEventToRunStreamEvent(
      { type: "plan.task.paused", runId: "r1", taskId: "y", at: 4000 },
      CTX,
    );
    expect(out.timeline).toEqual({
      kind: "task_transition",
      id: "y",
      transition: "paused",
    });
  });

  it("plan.task.resumed maps to resumed transition", () => {
    const out = translateBuilderEventToRunStreamEvent(
      { type: "plan.task.resumed", runId: "r1", taskId: "y", at: 5000 },
      CTX,
    );
    expect(out.timeline).toEqual({
      kind: "task_transition",
      id: "y",
      transition: "resumed",
    });
  });

  it("repairing milestone emits no task transition", () => {
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
