import { describe, expect, it } from "vitest";
import {
  chatStateReducer,
  createInitialChatState,
  type ChatUIState,
} from "@/features/agents/ui/agent-event-reducer";
import type { RunStreamEvent } from "@/shared/project-types";

function withActiveRun(messages: ChatUIState["messages"] = []): ChatUIState {
  const base = createInitialChatState(messages);
  return chatStateReducer(base, {
    type: "run.started",
    runId: "r1",
    projectId: "p1",
  });
}

const TASKS = [
  { id: "a", title: "Analyze brand", phase: "prep" as const },
  { id: "b", title: "Build the home page", phase: "build" as const },
  { id: "c", title: "Validate the preview", phase: "verify" as const },
];

describe("chatStateReducer — task events", () => {
  it("plan.created seeds tasks and all-pending statuses", () => {
    const state = withActiveRun();
    const next = chatStateReducer(state, {
      type: "plan.created",
      runId: "r1",
      tasks: TASKS,
      at: 1,
    });
    expect(next.activeRun?.tasks).toEqual(TASKS);
    expect(next.activeRun?.taskStatuses).toEqual({
      a: "pending",
      b: "pending",
      c: "pending",
    });
  });

  it("plan.task.started flips a task to active", () => {
    let state = chatStateReducer(withActiveRun(), {
      type: "plan.created",
      runId: "r1",
      tasks: TASKS,
      at: 1,
    });
    state = chatStateReducer(state, {
      type: "plan.task.started",
      runId: "r1",
      taskId: "a",
      at: 2,
    });
    expect(state.activeRun?.taskStatuses.a).toBe("active");
    expect(state.activeRun?.taskStatuses.b).toBe("pending");
  });

  it("plan.task.completed flips a task to done", () => {
    let state = chatStateReducer(withActiveRun(), {
      type: "plan.created",
      runId: "r1",
      tasks: TASKS,
      at: 1,
    });
    state = chatStateReducer(state, {
      type: "plan.task.completed",
      runId: "r1",
      taskId: "a",
      at: 2,
    });
    expect(state.activeRun?.taskStatuses.a).toBe("done");
  });

  it("plan.task.paused → plan.task.resumed cycle", () => {
    let state = chatStateReducer(withActiveRun(), {
      type: "plan.created",
      runId: "r1",
      tasks: TASKS,
      at: 1,
    });
    state = chatStateReducer(state, {
      type: "plan.task.started",
      runId: "r1",
      taskId: "b",
      at: 2,
    });
    state = chatStateReducer(state, {
      type: "plan.task.paused",
      runId: "r1",
      taskId: "b",
      at: 3,
    });
    expect(state.activeRun?.taskStatuses.b).toBe("paused");
    state = chatStateReducer(state, {
      type: "plan.task.resumed",
      runId: "r1",
      taskId: "b",
      at: 4,
    });
    expect(state.activeRun?.taskStatuses.b).toBe("active");
  });

  it("run.completed clears activeRun (drops tasks with the run)", () => {
    let state = chatStateReducer(withActiveRun(), {
      type: "plan.created",
      runId: "r1",
      tasks: TASKS,
      at: 1,
    });
    state = chatStateReducer(state, {
      type: "run.completed",
      runId: "r1",
      projectProcessingStatus: "idle",
    } satisfies RunStreamEvent);
    expect(state.activeRun).toBeNull();
  });

  it("plan events without an active run are ignored", () => {
    const state = createInitialChatState();
    const next = chatStateReducer(state, {
      type: "plan.created",
      runId: "r1",
      tasks: TASKS,
      at: 1,
    });
    expect(next.activeRun).toBeNull();
  });
});
