import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  chatStateReducer,
  createInitialChatState,
  runtimeStateReducer,
  CLIENT_SKELETON_LABELS,
  preserveSelectedOptions,
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
  | { kind: "clear-run" }
  | { kind: "prepend"; messages: Message[] }
  | { kind: "optimistic"; userMessage: Message }
  | { kind: "rollback"; tempId: string }
  | { kind: "set-runner-messages"; runId: string; messages: Message[] }
  | { kind: "stopping" };

function streamActionReducer(state: ChatUIState, action: StreamAction): ChatUIState {
  switch (action.kind) {
    case "run":
      return chatStateReducer(state, action.event);
    case "runtime":
      return { ...state, runtime: runtimeStateReducer(state.runtime, action.event) };
    case "reset":
      // Loads/replaces message history (initial fetch, project switch,
      // pagination top-up). It must NOT touch run lifecycle: `run.started`
      // from the SSE stream may have already seeded `activeRun`, and the
      // async messages fetch resolves AFTER that. Clearing activeRun here
      // wiped the in-flight run, so every later skeleton.update was dropped
      // (the reducer guards `if (!state.activeRun)`) and the route read the
      // runId→null transition as "run ended", flipping the project to idle.
      // activeRun is cleared explicitly via "clear-run" on project switch.
      return {
        ...createInitialChatState(preserveSelectedOptions(action.messages, state.messages)),
        runtime: state.runtime,
        activeRun: state.activeRun,
        // Preserve live-streamed runner sub-messages across the async history
        // fetch. Like activeRun, `run.started` + inner message.created events
        // can arrive BEFORE this reset resolves; wiping runnerMessages here
        // would drop every inner step captured so far, leaving the expanded
        // card empty until a reconnect re-streams them.
        runnerMessages: state.runnerMessages,
        lastRunOutcome: state.lastRunOutcome,
      };
    case "clear-run":
      return { ...state, activeRun: null };
    case "prepend": {
      const seen = new Set(state.messages.map((m) => m.id));
      const older = action.messages.filter((m) => !seen.has(m.id));
      return { ...state, messages: [...older, ...state.messages] };
    }
    case "optimistic":
      return {
        ...state,
        lastRunOutcome: null,
        messages: upsertById(state.messages, action.userMessage),
        activeRun: {
          runId: action.userMessage.id,
          status: "streaming",
          skeleton: { phase: "starting", label: CLIENT_SKELETON_LABELS.starting },
          todoItems: null,
        },
      };
    case "rollback":
      return {
        ...state,
        messages: state.messages.filter((m) => m.id !== action.tempId),
        activeRun: null,
      };
    case "set-runner-messages": {
      // Lazy-load result for an expanded runner card. Live SSE sub-messages
      // already in state win (they're the freshest for an in-flight run); the
      // fetched rows fill in the rest. Keyed by runId.
      const live = state.runnerMessages[action.runId] ?? [];
      const liveIds = new Set(live.map((m) => m.id));
      const merged = [
        ...action.messages.filter((m) => !liveIds.has(m.id)),
        ...live,
      ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return {
        ...state,
        runnerMessages: { ...state.runnerMessages, [action.runId]: merged },
      };
    }
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
  model?: string | null;
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

  const closeRuntimeSource = useCallback(() => {
    runtimeSourceRef.current?.close();
    runtimeSourceRef.current = null;
  }, []);

  const connectRuntime = useCallback(() => {
    if (!projectId) return;
    closeRuntimeSource();
    const source = new EventSource(`/api/projects/${projectId}/runtime/stream`);
    runtimeSourceRef.current = source;

    const onAny = (raw: MessageEvent) => {
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
      "dev_stopped",
      "preview_reload_requested",
      "heartbeat",
    ]) {
      source.addEventListener(type, onAny as EventListener);
    }
  }, [projectId, closeRuntimeSource]);

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
          "plan.todo_updated",
        ]) {
          source.addEventListener(type, onAny as EventListener);
        }
        armTimeout();
      };

      open();
    },
    [projectId, closeRunSource],
  );

  // Initial chat-history fetch. Keyed on projectId, so this also fires on a
  // genuine project switch — clear any stale run from the previous project
  // synchronously here (reset no longer owns run lifecycle). On mount this is
  // a no-op (activeRun starts null); the resume effect's `run.started` then
  // re-seeds activeRun for a project that's actually processing.
  useEffect(() => {
    dispatch({ kind: "clear-run" });
    closeRuntimeSource();
    connectRuntime();
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
      closeRuntimeSource();
    };
  }, [projectId, closeRuntimeSource, connectRuntime]);

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
            model: input.model ?? undefined,
            planMode: input.planMode ?? false,
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
    async (
      runId: string,
      answer: { optionId?: string; freeText?: string; planAction?: "approve" | "reject" },
    ): Promise<
      | { ok: true }
      | { ok: false; status: number; code: string; message: string }
    > => {
      let resp: Response;
      try {
        resp = await fetch(
          `/api/projects/${projectId}/builder-runs/${runId}/answer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(answer),
          },
        );
      } catch (cause) {
        return {
          ok: false,
          status: 0,
          code: "network_error",
          message:
            cause instanceof Error
              ? `Connection lost: ${cause.message}`
              : "Connection lost. Please check your network and try again.",
        };
      }
      if (resp.ok) return { ok: true };
      let body: { code?: unknown; message?: unknown } | null = null;
      try {
        body = (await resp.json()) as { code?: unknown; message?: unknown };
      } catch {
        body = null;
      }
      const code =
        body && typeof body.code === "string" ? body.code : `http_${resp.status}`;
      const fallback =
        resp.status === 404
          ? "This session has ended or the server restarted. Send a new message to start a new session."
          : resp.status === 409
            ? "This session is no longer awaiting a response. The agent may have moved on."
            : `Server returned an error (${resp.status}).`;
      const message =
        body && typeof body.message === "string" && body.message.trim()
          ? body.message
          : fallback;
      return { ok: false, status: resp.status, code, message };
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

  // Lazy-load a run's inner sub-messages (reasoning/agent_message/answer) from
  // runner_messages when the user expands the runner card. Live runs already
  // hold their inner messages in state from the SSE stream; this fills in
  // archived runs whose inner steps were never streamed to this client.
  const fetchRunnerMessages = useCallback(
    async (runId: string): Promise<void> => {
      try {
        const resp = await fetch(
          `/api/projects/${projectId}/builder-runs/${runId}/runner-messages`,
        );
        if (!resp.ok) return;
        const json = (await resp.json().catch(() => null)) as
          | { ok: true; messages: Message[] }
          | { ok: false }
          | null;
        if (!json || !("ok" in json) || !json.ok) return;
        dispatch({ kind: "set-runner-messages", runId, messages: json.messages });
      } catch {
        // Best-effort — a fetch miss leaves the card showing whatever live
        // inner messages already streamed in.
      }
    },
    [projectId],
  );

  return {
    state,
    sendPrompt,
    stopRun,
    retryRun,
    submitAnswer,
    fetchRunnerMessages,
    // Compat:
    startOptimistic,
    rollbackOptimistic,
    beginRun,
    markStopping,
    reset,
    prependMessages,
  };
}
