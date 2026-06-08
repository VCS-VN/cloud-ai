import { describe, expect, it } from "vitest";
import { translateBuilderEventToRunStreamEvent } from "@/server/services/builder-run-translator.server";
import type { BuilderRunEvent } from "@/features/agents/ui/builder-events";

const ctx = { runId: "r-1", projectId: "p-1", locale: "vi" as const };

const VARIANT_OPTIONS = [
  {
    id: "minimalist-retail",
    label: "Minimalist Retail",
    description: "Tối giản, sạch sẽ, tôn sản phẩm.",
    preview: { font: "Inter", palette: ["#ffffff", "#000000", "#cccccc"], motion: 0.2 },
  },
  {
    id: "warm-retail",
    label: "Warm Retail",
    description: "Tông màu ấm.",
    preview: { font: "Lora", palette: ["#fdf6ec", "#a05a2c", "#5e3a1d"], motion: 0.4 },
  },
];

describe("regression — agent_question metadata MUST appear in message.created event", () => {
  it("design_variant clarification: SSE event carries options + selectedOptionId=null", () => {
    const driverEvent: BuilderRunEvent = {
      type: "awaiting_clarification",
      runId: "r-1",
      milestone: "awaiting_clarification",
      question: "Chọn phong cách thiết kế cho cửa hàng",
      options: VARIANT_OPTIONS.map((v) => ({ id: v.id, label: v.label })),
      metadata: {
        questionType: "design_variant",
        options: VARIANT_OPTIONS,
        customAnswerAllowed: true,
      },
      at: 1_700_000_000_000,
    };

    const out = translateBuilderEventToRunStreamEvent(driverEvent, ctx);
    const created = out.events.find((e) => e.type === "message.created");
    expect(created).toBeDefined();
    if (!created || created.type !== "message.created") throw new Error("unreachable");
    expect(created.kind).toBe("agent_question");
    expect(created.metadata).not.toBeNull();
    expect(created.metadata).toEqual({
      questionType: "design_variant",
      options: VARIANT_OPTIONS,
      selectedOptionId: null,
    });
  });

  it("skill_clarification: SSE event carries clarification_options with non-empty options", () => {
    const driverEvent: BuilderRunEvent = {
      type: "awaiting_clarification",
      runId: "r-1",
      milestone: "awaiting_clarification",
      question: "Chọn một skill phù hợp",
      options: [{ id: "minimalist-ui", label: "Minimalist UI" }],
      metadata: {
        questionType: "skill_clarification",
        options: [{ id: "minimalist-ui", label: "Minimalist UI" }],
        customAnswerAllowed: false,
      },
      at: 1_700_000_000_000,
    };

    const out = translateBuilderEventToRunStreamEvent(driverEvent, ctx);
    const created = out.events.find((e) => e.type === "message.created");
    expect(created).toBeDefined();
    if (!created || created.type !== "message.created") throw new Error("unreachable");
    expect(created.metadata).not.toBeNull();
    if (!created.metadata) throw new Error("metadata must be present");
    expect(
      "questionType" in created.metadata ? created.metadata.questionType : null,
    ).toBe("clarification_options");
    expect(
      "options" in created.metadata ? created.metadata.options : null,
    ).toHaveLength(1);
  });

  it("event WITHOUT metadata: SSE event carries metadata: null (no crash)", () => {
    const driverEvent: BuilderRunEvent = {
      type: "awaiting_clarification",
      runId: "r-1",
      milestone: "awaiting_clarification",
      question: "Plain question with no metadata",
      options: [{ id: "yes", label: "Yes" }],
      at: 1_700_000_000_000,
    };

    const out = translateBuilderEventToRunStreamEvent(driverEvent, ctx);
    const created = out.events.find((e) => e.type === "message.created");
    if (!created || created.type !== "message.created") throw new Error("unreachable");
    expect(created.metadata).toBeNull();
  });
});
