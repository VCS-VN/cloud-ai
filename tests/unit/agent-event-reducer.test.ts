import { describe, expect, it } from "vitest";
import {
  chatStateReducer,
  createInitialChatState,
  preserveSelectedOptions,
} from "@/features/agents/ui/agent-event-reducer";
import type { Message } from "@/shared/project-types";

function agentQuestion(overrides: Partial<Message> = {}): Message {
  return {
    id: "db-question-1",
    projectId: "p1",
    role: "agent",
    kind: "agent_question",
    runId: "run-1",
    content: "Choose a design style for your store",
    status: "completed",
    processingStatus: "completed",
    createdAt: "2026-06-10T00:00:00.000Z",
    metadata: {
      questionType: "design_variant",
      options: [],
      selectedOptionId: null,
    },
    ...overrides,
  };
}

describe("agent-event-reducer selected answer persistence", () => {
  it("applies option.selected to the persisted DB message id", () => {
    const initial = createInitialChatState([agentQuestion()]);

    const next = chatStateReducer(initial, {
      type: "option.selected",
      runId: "run-1",
      messageId: "db-question-1",
      optionId: "minimalist-retail",
    });

    expect(next.messages[0].metadata).toMatchObject({
      selectedOptionId: "minimalist-retail",
    });
  });

  it("does not copy selectedOptionId to another question in the same run", () => {
    const existing = [
      agentQuestion({
        id: "db-question-1",
        metadata: {
          questionType: "design_variant",
          options: [],
          selectedOptionId: "minimalist-retail",
        },
      }),
    ];
    const incoming = [agentQuestion({ id: "db-question-2" })];

    const [preserved] = preserveSelectedOptions(incoming, existing);

    expect(preserved.metadata).toMatchObject({
      selectedOptionId: null,
    });
  });

  it("preserves selectedOptionId when refetched same message lacks committed state", () => {
    const existing = [
      agentQuestion({
        metadata: {
          questionType: "design_variant",
          options: [],
          selectedOptionId: "minimalist-retail",
        },
      }),
    ];
    const incoming = [agentQuestion({ id: "db-question-1" })];

    const [preserved] = preserveSelectedOptions(incoming, existing);

    expect(preserved.metadata).toMatchObject({
      selectedOptionId: "minimalist-retail",
    });
  });

  it("collapses duplicate message.created events with the same id", () => {
    const initial = createInitialChatState();
    const first = chatStateReducer(initial, {
      type: "message.created",
      runId: "run-1",
      messageId: "msg-run-1-answer",
      kind: "answer",
      content: "First answer",
      processingStatus: "completed",
      createdAt: "2026-06-10T00:00:00.000Z",
      metadata: null,
    });

    const next = chatStateReducer(first, {
      type: "message.created",
      runId: "run-1",
      messageId: "msg-run-1-answer",
      kind: "answer",
      content: "Final answer",
      processingStatus: "completed",
      createdAt: "2026-06-10T00:00:01.000Z",
      metadata: null,
    });

    expect(next.messages).toHaveLength(1);
    expect(next.messages[0]).toMatchObject({
      id: "msg-run-1-answer",
      content: "Final answer",
    });
  });
});
