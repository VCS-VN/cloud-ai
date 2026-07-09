// @vitest-environment jsdom
/**
 * End-to-end plan checklist: drive a sequence of plan.todo_updated events
 * through the client reducer, render <PlanChecklist> from the resulting
 * activeRun.todoItems, and assert the DOM reflects done/active/upcoming rows.
 */
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import {
  chatStateReducer,
  createInitialChatState,
  type ChatUIState,
} from "@/features/agents/ui/agent-event-reducer";
import { PlanChecklist } from "@/features/agents/ui/PlanChecklist";
import type { RunStreamEvent, TodoItem } from "@/shared/project-types";

afterEach(() => cleanup());

function startRun(): ChatUIState {
  return chatStateReducer(createInitialChatState(), {
    type: "run.started",
    runId: "r1",
    projectId: "p1",
  });
}

function todoUpdated(items: TodoItem[], at: number): RunStreamEvent {
  return { type: "plan.todo_updated", runId: "r1", items, at };
}

/** Read the visible display status ("Upcoming" | "In progress" | "Completed") for each row. */
function rowStatuses(): string[] {
  const list = screen.getByRole("list", { name: undefined });
  return within(list)
    .getAllByRole("listitem")
    .map((li) => {
      // The visible meta line duplicates the status label.
      const meta = li.querySelector(".plan-task-meta");
      return meta?.textContent?.trim() ?? "";
    });
}

describe("plan checklist end-to-end (reducer → render)", () => {
  it("renders done/active/upcoming rows from the reducer's todoItems", () => {
    let state = startRun();
    // First snapshot: nothing complete → first row active, rest upcoming.
    state = chatStateReducer(
      state,
      todoUpdated(
        [
          { id: "a", text: "Analyze brand", completed: false },
          { id: "b", text: "Build the home page", completed: false },
          { id: "c", text: "Validate the preview", completed: false },
        ],
        1,
      ),
    );
    // Second snapshot fully overwrites: first done → second becomes active.
    state = chatStateReducer(
      state,
      todoUpdated(
        [
          { id: "a", text: "Analyze brand", completed: true },
          { id: "b", text: "Build the home page", completed: false },
          { id: "c", text: "Validate the preview", completed: false },
        ],
        2,
      ),
    );

    render(
      <PlanChecklist
        todoItems={state.activeRun?.todoItems ?? null}
        runClosed={state.activeRun === null}
      />,
    );

    expect(screen.getByText("Analyze brand")).toBeInTheDocument();
    expect(rowStatuses()).toEqual(["Completed", "In progress", "Upcoming"]);
    // Active row shows a spinner while the run is live.
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    // Live header shows progress, not a terminal summary.
    expect(screen.getByText(/1 \/ 3 done/)).toBeInTheDocument();
  });

  it("when the run closes, spinner is hidden and header shows Completed N of T", () => {
    let state = startRun();
    state = chatStateReducer(
      state,
      todoUpdated(
        [
          { id: "a", text: "Analyze brand", completed: true },
          { id: "b", text: "Build the home page", completed: true },
        ],
        1,
      ),
    );
    // Snapshot todoItems before the run terminates (activeRun is cleared).
    const finalItems = state.activeRun?.todoItems ?? null;
    state = chatStateReducer(state, {
      type: "run.completed",
      runId: "r1",
      projectProcessingStatus: "idle",
    });
    expect(state.activeRun).toBeNull();

    render(<PlanChecklist todoItems={finalItems} runClosed={true} />);

    expect(rowStatuses()).toEqual(["Completed", "Completed"]);
    expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
    expect(screen.getByText("Completed 2 of 2 tasks")).toBeInTheDocument();
  });

  it("a stopped run with unfinished tasks shows Stopped N of T", () => {
    let state = startRun();
    state = chatStateReducer(
      state,
      todoUpdated(
        [
          { id: "a", text: "Analyze brand", completed: true },
          { id: "b", text: "Build the home page", completed: false },
        ],
        1,
      ),
    );
    const finalItems = state.activeRun?.todoItems ?? null;

    render(<PlanChecklist todoItems={finalItems} runClosed={true} />);

    // First non-completed row is still "active" (just no spinner when closed).
    expect(rowStatuses()).toEqual(["Completed", "In progress"]);
    expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
    expect(screen.getByText("Stopped 1 of 2 tasks")).toBeInTheDocument();
  });
});
