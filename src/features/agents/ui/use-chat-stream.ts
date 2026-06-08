import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  chatStateReducer,
  createInitialChatState,
  runtimeStateReducer,
  CLIENT_SKELETON_LABELS,
  type ChatUIState,
} from "@/features/agents/ui/agent-event-reducer";
import type {
  ComposerReasoningEffort,
  Message,
  MessagePage,
  RunStreamEvent,
  RuntimeStreamEvent,
} from "@/shared/project-types";

const SSE_TIMEOUT_MS = 30_000;

type StreamAction =
  | { kind: "run"; event: RunStreamEvent }
  | { kind: "runtime"; event: RuntimeStreamEvent }
  | { kind: "reset"; messages: Message[] }
  | { kind: "prepend"; messages: Message[] }
  | { kind: "optimistic"; userMessage: Message }
  | { kind: "rollback"; tempId: string }
  | { kind: "stopping" };

function streamActionReducer(state: ChatUIState, action: StreamAction): ChatUIState {
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
        messages: upsertById(state.messages, action.userMessage),
        activeRun: {
          runId: action.userMessage.id,
          status: "streaming",
          skeleton: { phase: "starting", label: CLIENT_SKELETON_LABELS.starting },
          tasks: null,
          taskStatuses: {},
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

function upsertById(messages: Message[], message: Message): Message[] {
  const index = messages.findIndex((item) => item.id === message.id);
  if (index < 0) return [...messages, message];
  const next = [...messages];
  next[index] = message;
  return next;
}

export type UseChatStreamArgs = {
  projectId: string;
  initialMessages?: Message[];
  activeRunId?: string | null;
};

export type SendPromptInput = {
  prompt: string;
  reasoningEffort?: ComposerReasoningEffort;
  planMode?: boolean;
};

export type SendPromptResult =
  | { ok: true; runId: string; userMessage: Message }
  | { ok: false; code: string; message: string };

export function useChatStream({
  projectId,
  initialMessages = [],
  activeRunId,
}: UseChatStreamArgs) {
  const [state, dispatch] = useReducer(
    streamActionReducer,
    initialMessages,
    createInitialChatState,
  );

  const runSourceRef = useRef<EventSource | null>(null);
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
        const source = new EventSource(
          `/api/projects/${projectId}/builder-runs/${runId}/stream`,
        );
        runSourceRef.current = source;

        const armTimeout = () => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
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
          "milestone",
          "message.created",
          "message.delta",
          "message.completed",
          "skeleton.update",
          "run.awaiting_input",
          "awaiting_clarification",
          "option.selected",
          "run.completed",
          "run.failed",
          "run.stopped",
          "done",
          "failed",
          "cancelled",
          "heartbeat",
          "plan.created",
          "plan.task.started",
          "plan.task.completed",
          "plan.task.paused",
          "plan.task.resumed",
        ]) {
          source.addEventListener(type, onAny as EventListener);
        }
        armTimeout();
      };

      open();
    },
    [projectId, closeRunSource],
  );

  // Initial chat-history fetch.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/messages?limit=50`)
      .then((resp) => (resp.ok ? resp.json() : null))
      .then((page: (MessagePage & { ok: true }) | null) => {
        if (cancelled || !page) return;
        dispatch({ kind: "reset", messages: page.messages });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Resume an in-flight run on mount.
  useEffect(() => {
    if (activeRunId) connectRun(activeRunId);
    return () => closeRunSource();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRunId]);

  const sendPrompt = useCallback(
    async (input: SendPromptInput): Promise<SendPromptResult> => {
      const tempId = `temp-${Math.random().toString(36).slice(2)}`;
      const optimistic: Message = {
        id: tempId,
        projectId,
        role: "user",
        content: input.prompt,
        status: "completed",
        processingStatus: "completed",
        createdAt: new Date().toISOString(),
      };
      dispatch({ kind: "optimistic", userMessage: optimistic });
      try {
        const resp = await fetch(`/api/projects/${projectId}/builder-runs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: input.prompt,
            reasoningEffort: input.reasoningEffort,
            planMode: input.planMode ?? false,
            locale: "vi-VN",
          }),
        });
        const json = (await resp.json().catch(() => null)) as
          | {
              ok: true;
              runId: string;
              userMessage: Message;
            }
          | { ok: false; code: string; message: string }
          | null;
        if (!resp.ok || !json || !("ok" in json) || !json.ok) {
          dispatch({ kind: "rollback", tempId });
          return {
            ok: false,
            code: (json && "code" in json && json.code) || "request_failed",
            message:
              (json && "message" in json && json.message) ||
              "Could not start the run.",
          };
        }
        dispatch({ kind: "rollback", tempId });
        dispatch({ kind: "optimistic", userMessage: json.userMessage });
        connectRun(json.runId);
        return { ok: true, runId: json.runId, userMessage: json.userMessage };
      } catch (error) {
        dispatch({ kind: "rollback", tempId });
        return {
          ok: false,
          code: "request_failed",
          message: error instanceof Error ? error.message : "Request failed.",
        };
      }
    },
    [projectId, connectRun],
  );

  const stopRun = useCallback(
    async (runId: string): Promise<boolean> => {
      dispatch({ kind: "stopping" });
      const resp = await fetch(
        `/api/projects/${projectId}/builder-runs/${runId}/cancel`,
        { method: "POST" },
      );
      return resp.ok;
    },
    [projectId],
  );

  const retryRun = useCallback(
    async (runId: string): Promise<SendPromptResult> => {
      const resp = await fetch(
        `/api/projects/${projectId}/builder-runs/${runId}/retry`,
        { method: "POST" },
      );
      const json = (await resp.json().catch(() => null)) as
        | { ok: true; runId: string; userMessage: Message }
        | { ok: false; code: string; message: string }
        | null;
      if (!resp.ok || !json || !json.ok) {
        return {
          ok: false,
          code: (json && "code" in json && json.code) || "request_failed",
          message:
            (json && "message" in json && json.message) ||
            "Retry failed.",
        };
      }
      connectRun(json.runId);
      return { ok: true, runId: json.runId, userMessage: json.userMessage };
    },
    [projectId, connectRun],
  );

  const submitAnswer = useCallback(
    async (runId: string, answer: { optionId?: string; freeText?: string; planAction?: "approve" | "reject" }) => {
      const resp = await fetch(
        `/api/projects/${projectId}/builder-runs/${runId}/answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(answer),
        },
      );
      return resp.ok;
    },
    [projectId],
  );

  // Compat surface to match useAgentStream so the project route can swap
  // imports without a wholesale rewrite. Phase 10 cleanup will retire the
  // legacy hook entirely.
  const startOptimistic = useCallback((userMessage: Message) => {
    dispatch({ kind: "optimistic", userMessage });
  }, []);
  const rollbackOptimistic = useCallback((tempId: string) => {
    dispatch({ kind: "rollback", tempId });
  }, []);
  const beginRun = useCallback(
    (runId: string, realUserMessage?: Message, tempId?: string) => {
      if (tempId) dispatch({ kind: "rollback", tempId });
      if (realUserMessage)
        dispatch({ kind: "optimistic", userMessage: realUserMessage });
      connectRun(runId);
    },
    [connectRun],
  );
  const markStopping = useCallback(() => dispatch({ kind: "stopping" }), []);
  const reset = useCallback(
    (messages: Message[]) => dispatch({ kind: "reset", messages }),
    [],
  );
  const prependMessages = useCallback(
    (messages: Message[]) => dispatch({ kind: "prepend", messages }),
    [],
  );

  return {
    state,
    sendPrompt,
    stopRun,
    retryRun,
    submitAnswer,
    // Compat:
    startOptimistic,
    rollbackOptimistic,
    beginRun,
    markStopping,
    reset,
    prependMessages,
  };
}
