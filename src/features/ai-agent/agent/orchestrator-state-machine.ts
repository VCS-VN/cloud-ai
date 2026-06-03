/**
 * OrchestratorStateMachine — event-driven, serializable state machine
 * for the AI Agent run lifecycle (feature 023).
 *
 * States: idle → analyzing → planning → awaiting_input → executing → validating → responding → completed/failed/stopped
 * Multi-cycle: awaiting_input → planning → ... → awaiting_input can repeat
 * Terminal states: completed, failed, stopped
 */

import type { OrchestratorState } from "@/shared/project-types";

// --- Events ---

export type OrchestratorEvent =
  | { type: "start" }
  | { type: "thinking_started" }
  | { type: "plan_created" }
  | { type: "agent_question_asked" }
  | { type: "user_option_selected" }
  | { type: "tool_call_completed" }
  | { type: "done" }
  | { type: "error" }
  | { type: "stop" };

// --- Serialized shape ---

type SerializedState = {
  current: OrchestratorState;
  history: OrchestratorState[];
};

const VALID_STATES: ReadonlySet<string> = new Set<OrchestratorState>([
  "idle",
  "analyzing",
  "planning",
  "awaiting_input",
  "executing",
  "validating",
  "responding",
  "completed",
  "failed",
  "stopped",
]);

const TERMINAL_STATES: ReadonlySet<OrchestratorState> = new Set([
  "completed",
  "failed",
  "stopped",
]);

// --- Transition table ---

// For each (current state, event type), allowed next state.
// Absent entries are invalid transitions.
const TRANSITIONS: Record<string, Record<string, OrchestratorState>> = {
  idle: {
    start: "analyzing",
  },
  analyzing: {
    thinking_started: "planning",
    agent_question_asked: "awaiting_input",
    error: "failed",
    stop: "stopped",
  },
  planning: {
    plan_created: "executing",
    tool_call_completed: "executing",
    agent_question_asked: "awaiting_input",
    error: "failed",
    stop: "stopped",
  },
  awaiting_input: {
    user_option_selected: "planning",
    error: "failed",
    stop: "stopped",
  },
  executing: {
    tool_call_completed: "validating",
    agent_question_asked: "awaiting_input",
    error: "failed",
    stop: "stopped",
  },
  validating: {
    tool_call_completed: "executing", // fix loop
    done: "responding",
    agent_question_asked: "awaiting_input",
    error: "failed",
    stop: "stopped",
  },
  responding: {
    done: "completed",
    error: "failed",
  },
  // Terminal states have no transitions
};

export class OrchestratorStateMachine {
  private _current: OrchestratorState;
  private _history: OrchestratorState[];

  constructor(initial: OrchestratorState = "idle") {
    this._current = initial;
    this._history = [initial];
  }

  get current(): OrchestratorState {
    return this._current;
  }

  get history(): ReadonlyArray<OrchestratorState> {
    return this._history;
  }

  isTerminal(): boolean {
    return TERMINAL_STATES.has(this._current);
  }

  isActive(): boolean {
    return !this.isTerminal();
  }

  /** Execute a transition. Returns the new state. Throws on invalid transition. */
  transition(event: OrchestratorEvent): OrchestratorState {
    if (this.isTerminal()) {
      throw new Error(
        `Cannot transition from terminal state "${this._current}"`
      );
    }

    const allowed = TRANSITIONS[this._current];
    if (!allowed) {
      throw new Error(`No transitions defined for state "${this._current}"`);
    }

    const next = allowed[event.type];
    if (!next) {
      throw new Error(
        `Invalid transition: "${this._current}" + "${event.type}" is not allowed`
      );
    }

    this._current = next;
    this._history.push(next);
    return next;
  }

  /** Serialize to JSON string — survives server restart. */
  serialize(): string {
    const data: SerializedState = {
      current: this._current,
      history: [...this._history],
    };
    return JSON.stringify(data);
  }

  /** Deserialize from JSON string, validating structure. */
  static deserialize(json: string): OrchestratorStateMachine {
    const data = JSON.parse(json) as SerializedState;

    if (!data.current || !VALID_STATES.has(data.current)) {
      throw new Error(
        `Invalid serialized state: "${String(data.current)}" is not a valid OrchestratorState`
      );
    }

    if (!Array.isArray(data.history)) {
      throw new Error("Invalid serialized state: history must be an array");
    }

    for (const s of data.history) {
      if (!VALID_STATES.has(s)) {
        throw new Error(
          `Invalid serialized state: "${s}" in history is not a valid OrchestratorState`
        );
      }
    }

    const machine = new OrchestratorStateMachine(data.current);
    // Replace history preserving the initial
    machine._history = data.history;
    return machine;
  }
}
