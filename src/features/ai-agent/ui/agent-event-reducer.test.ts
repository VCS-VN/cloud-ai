import { describe, expect, it } from "vitest";
import type { AgentStreamEvent } from "../agent/agent-events";
import { agentEventReducer, createInitialAgentEventState } from "./agent-event-reducer";

function reduceEvents(events: AgentStreamEvent[]) {
  return events.reduce(agentEventReducer, createInitialAgentEventState());
}

describe("agentEventReducer thinking events", () => {
  it("tracks sanitized thinking progress", () => {
    const state = reduceEvents([
      { type: "thinking_started", runId: "run_1", message: "Đang phân tích yêu cầu của bạn..." },
      { type: "thinking_context_loaded", runId: "run_1", projectStatus: "initialized", hasInitializedSource: true },
      {
        type: "thinking_completed",
        runId: "run_1",
        taskType: "incremental_source_update",
        normalizedGoal: "Add product filters to listing pages.",
        riskLevel: "low",
        summary: "Add product filters.",
        intent: "add_feature",
        confidence: 0.91,
        affectedPages: ["/products"],
        affectedFeatures: ["product-filter"],
        conversionGoal: "improve_product_discovery",
      },
    ]);

    expect(state.thinking).toMatchObject({
      started: true,
      message: "Đang phân tích yêu cầu của bạn...",
      projectStatus: "initialized",
      hasInitializedSource: true,
      completed: { type: "thinking_completed", summary: "Add product filters." },
    });
    expect(JSON.stringify(state)).not.toContain("rawPrompt");
    expect(JSON.stringify(state)).not.toContain("provider");
  });

  it("tracks sanitized clarification requests", () => {
    const state = reduceEvents([
      {
        type: "clarification_required",
        runId: "run_1",
        question: "Bạn muốn xác nhận thay đổi này trước khi tiếp tục không?",
        reason: "Yêu cầu có rủi ro cao hoặc cần thêm thông tin.",
      },
    ]);

    expect(state.clarification).toMatchObject({
      type: "clarification_required",
      runId: "run_1",
      question: "Bạn muốn xác nhận thay đổi này trước khi tiếp tục không?",
      reason: "Yêu cầu có rủi ro cao hoặc cần thêm thông tin.",
    });
    expect(JSON.stringify(state)).not.toContain("rawPrompt");
    expect(JSON.stringify(state)).not.toContain("provider");
  });
});
