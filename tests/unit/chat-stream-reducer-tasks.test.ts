import { describe, expect, it } from "vitest";
import {
  chatStateReducer,
  createInitialChatState,
  type ChatUIState,
} from "@/features/agents/ui/agent-event-reducer";
import type { RunStreamEvent, TodoItem } from "@/shared/project-types";

function withActiveRun(messages: ChatUIState["messages"] = []): ChatUIState {
  const base = createInitialChatState(messages);
  return chatStateReducer(base, {
    type: "run.started",
    runId: "r1",
    projectId: "p1",
  });
}

const ITEMS: TodoItem[] = [
  { id: "a", text: "Analyze brand", completed: false },
  { id: "b", text: "Build the home page", completed: false },
  { id: "c", text: "Validate the preview", completed: false },
];

function todoUpdatedEvent(items: TodoItem[], at = 1) {
  return { type: "plan.todo_updated" as const, runId: "r1", items, at };
}

describe("chatStateReducer — todo events", () => {
  it("plan.todo_updated sets activeRun.todoItems to the emitted items", () => {
    const state = withActiveRun();
    const next = chatStateReducer(state, todoUpdatedEvent(ITEMS));
    expect(next.activeRun?.todoItems).toEqual(ITEMS);
  });

  it("a later plan.todo_updated fully overwrites the earlier todoItems", () => {
    let state = chatStateReducer(withActiveRun(), todoUpdatedEvent(ITEMS, 1));
    const updated: TodoItem[] = [
      { id: "a", text: "Analyze brand", completed: true },
      { id: "b", text: "Build the home page", completed: true },
      { id: "c", text: "Validate the preview", completed: false },
    ];
    state = chatStateReducer(state, todoUpdatedEvent(updated, 2));
    expect(state.activeRun?.todoItems).toEqual(updated);
  });

  it("plan.todo_updated without an active run is ignored", () => {
    const state = createInitialChatState();
    const next = chatStateReducer(state, todoUpdatedEvent(ITEMS));
    expect(next.activeRun).toBeNull();
  });

  it("run.started resets todoItems to null", () => {
    let state = chatStateReducer(withActiveRun(), todoUpdatedEvent(ITEMS));
    expect(state.activeRun?.todoItems).toEqual(ITEMS);
    state = chatStateReducer(state, {
      type: "run.started",
      runId: "r2",
      projectId: "p1",
    });
    expect(state.activeRun?.todoItems).toBeNull();
  });

  it("option.selected preserves todoItems from the prior run state", () => {
    // option.selected re-seeds activeRun; it carries the existing todoItems
    // forward (rather than dropping them) so the checklist survives a picker.
    let state = chatStateReducer(withActiveRun(), todoUpdatedEvent(ITEMS));
    state = chatStateReducer(state, {
      type: "option.selected",
      runId: "r1",
      messageId: "m1",
      optionId: "opt-1",
    } satisfies RunStreamEvent);
    expect(state.activeRun?.todoItems).toEqual(ITEMS);
  });

  it("run.completed clears activeRun (drops todoItems with the run)", () => {
    let state = chatStateReducer(withActiveRun(), todoUpdatedEvent(ITEMS));
    state = chatStateReducer(state, {
      type: "run.completed",
      runId: "r1",
      projectProcessingStatus: "idle",
    } satisfies RunStreamEvent);
    expect(state.activeRun).toBeNull();
  });
});
