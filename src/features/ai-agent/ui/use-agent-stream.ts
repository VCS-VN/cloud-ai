import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  chatStateReducer,
  createInitialChatState,
  runtimeStateReducer,
  CLIENT_SKELETON_LABELS,
  type ChatUIState,
} from "./agent-event-reducer";
import type {
  Message,
  RunStreamEvent,
  RuntimeStreamEvent,
} from "@/shared/project-types";

const SSE_TIMEOUT_MS = 30_000;

export type StreamAction =
  | { kind: "run"; event: RunStreamEvent }
  | { kind: "runtime"; event: RuntimeStreamEvent }
  | { kind: "reset"; messages: Message[] }
  | { kind: "prepend"; messages: Message[] }
  | { kind: "optimistic"; userMessage: Message }
  | { kind: "rollback"; tempId: string }
  | { kind: "stopping" };

export function streamActionReducer(state: ChatUIState, action: StreamAction): ChatUIState {
  switch (action.kind) {
    case "run":
      return chatStateReducer(state, action.event);
    case "runtime":
      return { ...state, runtime: runtimeStateReducer(state.runtime, action.event) };
    case "reset":
      return createInitialChatState(action.messages);
    case "prepend": {
      const seen = new Set(state.messages.map((m) => m.id));
      const older = action.messages.filter((m) => !seen.has(m.id));
      return { ...state, messages: [...older, ...state.messages] };
    }
    case "optimistic":
      return {
        ...state,
        messages: [...state.messages, action.userMessage],
        activeRun: {
          runId: action.userMessage.id, // temp id until POST returns real runId
          status: "streaming",
          skeleton: { phase: "starting", label: CLIENT_SKELETON_LABELS.starting },
        },
      };
    case "rollback":
      return {
        ...state,
        messages: state.messages.filter((m) => m.id !== action.tempId),
        activeRun: null,
      };
    case "stopping":
      return state.activeRun
        ? {
            ...state,
            activeRun: {
              ...state.activeRun,
              skeleton: { phase: "starting", label: "Stopping…" },
            },
          }
        : state;
    default:
      return state;
  }
}

export type UseAgentStreamArgs = {
  projectId: string;
  initialMessages?: Message[];
  activeRunId?: string | null;
};

export function useAgentStream({ projectId, initialMessages = [], activeRunId }: UseAgentStreamArgs) {
  const [state, dispatch] = useReducer(streamActionReducer, initialMessages, createInitialChatState);

  const runSourceRef = useRef<EventSource | null>(null);
  const runtimeSourceRef = useRef<EventSource | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriedRef = useRef(false);
  const currentRunRef = useRef<string | null>(null);

  const closeRunSource = useCallback(() => {
    runSourceRef.current?.close();
    runSourceRef.current = null;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const connectRun = useCallback(
    (runId: string) => {
      closeRunSource();
      currentRunRef.current = runId;
      retriedRef.current = false;

      const open = () => {
        const source = new EventSource(`/api/projects/${projectId}/runs/${runId}/stream`);
        runSourceRef.current = source;

        const armTimeout = () => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            // No event (not even heartbeat) within window: reconnect once, then fail.
            source.close();
            if (!retriedRef.current) {
              retriedRef.current = true;
              open();
            } else {
              dispatch({
                kind: "run",
                event: {
                  type: "run.failed",
                  runId,
                  projectProcessingStatus: "idle",
                  error: { code: "PROVIDER_STREAM_FAILED", message: "The connection timed out." },
                },
              });
              closeRunSource();
            }
          }, SSE_TIMEOUT_MS);
        };

        const onAny = (raw: MessageEvent) => {
          armTimeout();
          const event = JSON.parse(raw.data) as RunStreamEvent;
          dispatch({ kind: "run", event });
          if (
            event.type === "run.completed" ||
            event.type === "run.failed" ||
            event.type === "run.stopped"
          ) {
            closeRunSource();
          }
        };

        for (const type of [
          "run.started",
          "message.created",
          "message.delta",
          "message.completed",
          "skeleton.update",
          "run.completed",
          "run.failed",
          "run.stopped",
          "heartbeat",
        ]) {
          source.addEventListener(type, onAny as EventListener);
        }
        armTimeout();
      };

      open();
    },
    [projectId, closeRunSource],
  );

  // Runtime channel: open for the lifetime of the project page.
  useEffect(() => {
    const source = new EventSource(`/api/projects/${projectId}/runtime/stream`);
    runtimeSourceRef.current = source;
    const onRuntime = (raw: MessageEvent) => {
      const event = JSON.parse(raw.data) as RuntimeStreamEvent;
      dispatch({ kind: "runtime", event });
    };
    for (const type of [
      "dev_install_started",
      "dev_install_completed",
      "dev_install_failed",
      "dev_starting",
      "dev_ready",
      "dev_error",
      "dev_fix_attempt",
      "dev_fix_applied",
      "dev_fix_failed",
      "heartbeat",
    ]) {
      source.addEventListener(type, onRuntime as EventListener);
    }
    return () => {
      source.close();
      runtimeSourceRef.current = null;
    };
  }, [projectId]);

  // Resume an in-flight run after reload.
  useEffect(() => {
    if (activeRunId) connectRun(activeRunId);
    return () => closeRunSource();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRunId]);

  const startOptimistic = useCallback((userMessage: Message) => {
    dispatch({ kind: "optimistic", userMessage });
  }, []);

  const rollbackOptimistic = useCallback((tempId: string) => {
    dispatch({ kind: "rollback", tempId });
  }, []);

  const beginRun = useCallback(
    (runId: string, realUserMessage?: Message, tempId?: string) => {
      if (tempId) dispatch({ kind: "rollback", tempId });
      if (realUserMessage) dispatch({ kind: "optimistic", userMessage: realUserMessage });
      connectRun(runId);
    },
    [connectRun],
  );

  const markStopping = useCallback(() => dispatch({ kind: "stopping" }), []);

  const reset = useCallback((messages: Message[]) => dispatch({ kind: "reset", messages }), []);

  const prependMessages = useCallback(
    (messages: Message[]) => dispatch({ kind: "prepend", messages }),
    [],
  );

  return {
    state,
    startOptimistic,
    rollbackOptimistic,
    beginRun,
    markStopping,
    reset,
    prependMessages,
  };
}
