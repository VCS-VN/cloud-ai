import { describe, expect, it } from "vitest";
import type { AgentStreamEvent } from "./agent-events";

const FORBIDDEN_CLIENT_FIELDS = ["rawPrompt", "provider"];

function expectSanitizedEvent(event: AgentStreamEvent) {
  const serialized = JSON.stringify(event);
  for (const field of FORBIDDEN_CLIENT_FIELDS) {
    expect(serialized).not.toContain(field);
  }
}

describe("AgentStreamEvent thinking contracts", () => {
  it("accepts sanitized thinking_started events", () => {
    const event = {
      type: "thinking_started",
      runId: "run_1",
      message: "Đang phân tích yêu cầu của bạn...",
    } satisfies AgentStreamEvent;

    expect(event).toMatchObject({ type: "thinking_started", runId: "run_1" });
    expectSanitizedEvent(event);
  });

  it("accepts sanitized thinking_context_loaded events", () => {
    const event = {
      type: "thinking_context_loaded",
      runId: "run_1",
      projectStatus: "initialized",
      hasInitializedSource: true,
    } satisfies AgentStreamEvent;

    expect(event).toMatchObject({ type: "thinking_context_loaded", hasInitializedSource: true });
    expectSanitizedEvent(event);
  });

  it("accepts sanitized thinking_completed events", () => {
    const event = {
      type: "thinking_completed",
      runId: "run_1",
      taskType: "incremental_source_update",
      normalizedGoal: "Add product filters to the product listing page.",
      riskLevel: "low",
      summary: "Add product filters to the listing experience.",
      intent: "add_feature",
      confidence: 0.92,
      affectedPages: ["/products"],
      affectedFeatures: ["product-filter"],
      conversionGoal: "improve_product_discovery",
    } satisfies AgentStreamEvent;

    expect(event).toMatchObject({ type: "thinking_completed", intent: "add_feature" });
    expectSanitizedEvent(event);
  });

  it("accepts sanitized clarification_required events", () => {
    const event = {
      type: "clarification_required",
      runId: "run_1",
      question: "Bạn muốn xác nhận thay đổi này trước khi tiếp tục không?",
      reason: "Yêu cầu có rủi ro cao hoặc cần thêm thông tin.",
    } satisfies AgentStreamEvent;

    expect(event).toMatchObject({ type: "clarification_required", runId: "run_1" });
    expectSanitizedEvent(event);
  });
});
