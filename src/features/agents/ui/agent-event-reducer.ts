import type {
  AgentQuestionMetadata,
  Message,
  RunStreamEvent,
  RuntimeStreamEvent,
  RunUIState,
  SkeletonPhase,
  StreamError,
} from "@/shared/project-types";
import type { DevRuntimeEvent } from "@/features/runtime/legacy/runtime-events";
import { stripUnsafeContent } from "@/shared/agent-text-safety";

export type DevRuntimeUIState = {
  status: "idle" | "installing" | "installed" | "starting" | "running" | "stopped" | "error" | "fixing";
  previewUrl: string | null;
  previewPort: number | null;
  error: string | null;
  errorTier: "code" | "config" | "system" | null;
  fixAttempt: number | null;
  fixChangedFiles: string[];
  durationMs: number | null;
  previewReloadRequestedAt: string | null;
  previewReloadDelayMs: number | null;
  previewReloadReason: "store_slug_synced" | null;
};

export type ChatUIState = {
  messages: Message[];
  // Inner sub-messages of a run (reasoning / agent_message / answer), keyed by
  // runId. These are the steps revealed when the user expands the runner card;
  // they never render as top-level chat bubbles. Populated live from the SSE
  // stream and lazy-loaded from runner_messages on expand.
  runnerMessages: Record<string, Message[]>;
  activeRun: RunUIState | null;
  runtime: DevRuntimeUIState;
  // Terminal outcome of the most recently cleared run. Lets the route decide
  // whether to auto-start the preview (only on "completed"). Reset to null when
  // a new run starts.
  lastRunOutcome: "completed" | "failed" | "stopped" | null;
};

// Kinds that live inside the runner card (runner_messages), not as top-level
// chat bubbles. Mirrors the server-side routing in persistAgentMessage.
const RUNNER_INNER_KINDS: ReadonlySet<string> = new Set([
  "reasoning",
  "agent_message",
  "answer",
]);

function isRunnerInnerKind(kind: string | undefined): boolean {
  return kind !== undefined && RUNNER_INNER_KINDS.has(kind);
}

const INITIAL_RUNTIME: DevRuntimeUIState = {
  status: "idle",
  previewUrl: null,
  previewPort: null,
  error: null,
  errorTier: null,
  fixAttempt: null,
  fixChangedFiles: [],
  durationMs: null,
  previewReloadRequestedAt: null,
  previewReloadDelayMs: null,
  previewReloadReason: null,
};

export function createInitialChatState(messages: Message[] = []): ChatUIState {
  return {
    messages,
    runnerMessages: {},
    activeRun: null,
    runtime: { ...INITIAL_RUNTIME },
    lastRunOutcome: null,
  };
}

function upsertRunnerMessage(
  runnerMessages: Record<string, Message[]>,
  message: Message,
): Record<string, Message[]> {
  const runId = message.runId;
  if (!runId) return runnerMessages;
  const existing = runnerMessages[runId] ?? [];
  const idx = existing.findIndex((m) => m.id === message.id);
  const next =
    idx >= 0
      ? existing.map((m, i) => (i === idx ? message : m))
      : [...existing, message];
  return { ...runnerMessages, [runId]: next };
}

// Patch a runner sub-message by id. The delta/completed events don't carry the
// runId of the containing bucket, so scan every run for the matching message —
// ids are unique across runs (msg-${runId}-...), so at most one bucket matches.
function patchRunnerMessage(
  runnerMessages: Record<string, Message[]>,
  messageId: string,
  patch: Partial<Message>,
): Record<string, Message[]> {
  for (const [runId, messages] of Object.entries(runnerMessages)) {
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx < 0) continue;
    const next = [...messages];
    next[idx] = { ...next[idx], ...patch };
    return { ...runnerMessages, [runId]: next };
  }
  return runnerMessages;
}

function findRunnerMessage(
  runnerMessages: Record<string, Message[]>,
  messageId: string,
): Message | undefined {
  for (const messages of Object.values(runnerMessages)) {
    const found = messages.find((m) => m.id === messageId);
    if (found) return found;
  }
  return undefined;
}

export const CLIENT_SKELETON_LABELS: Record<SkeletonPhase, string> = {
  starting: "Processing your request",
  understanding: "Understanding your request",
  planning: "Planning your storefront",
  editing: "Updating your storefront",
  installing: "Installing packages",
  starting_preview: "Starting your preview",
  validating: "Checking your storefront",
  repairing: "Fixing an issue",
  responding: "Writing a response",
};

function getSelectedOptionId(message: Message): string | undefined {
  return message.kind === "agent_question" &&
    message.metadata &&
    typeof (message.metadata as { selectedOptionId?: unknown }).selectedOptionId === "string"
    ? ((message.metadata as { selectedOptionId: string }).selectedOptionId)
    : undefined;
}

export function preserveSelectedOptions(incoming: Message[], existing: Message[]): Message[] {
  return incoming.map((message) => {
    if (getSelectedOptionId(message)) return message;
    const previous = existing.find((item) => item.id === message.id);
    const selectedOptionId = previous ? getSelectedOptionId(previous) : undefined;
    if (!selectedOptionId) return message;
    return {
      ...message,
      metadata: { ...message.metadata, selectedOptionId } as AgentQuestionMetadata,
    };
  });
}

function upsertMessage(messages: Message[], message: Message): Message[] {
  const idx = messages.findIndex((m) => m.id === message.id);
  if (idx >= 0) {
    const next = [...messages];
    next[idx] = message;
    return next;
  }
  return [...messages, message];
}

function patchMessage(
  messages: Message[],
  messageId: string,
  patch: Partial<Message>,
): Message[] {
  const idx = messages.findIndex((m) => m.id === messageId);
  if (idx < 0) return messages;
  const next = [...messages];
  next[idx] = { ...next[idx], ...patch };
  return next;
}

/** Reducer for the run stream channel. Terminal events clear activeRun immediately. */
export function chatStateReducer(state: ChatUIState, event: RunStreamEvent): ChatUIState {
  switch (event.type) {
    case "run.started":
      return {
        ...state,
        lastRunOutcome: null,
        activeRun: {
          runId: event.runId,
          status: "streaming",
          // Seed a default skeleton so the processing affordance shows
          // immediately. Without this the panel renders nothing between
          // run.started and the first skeleton.update (seconds during init),
          // leaving the user unsure the agent is working.
          skeleton: { phase: "starting", label: CLIENT_SKELETON_LABELS.starting },
          todoItems: null,
        },
      };

    case "message.created": {
      // Inner steps (reasoning/agent_message/answer) belong to the runner card,
      // not the top-level chat. Route them into runnerMessages keyed by runId so
      // the collapsible card can reveal them on expand. plan/agent_question/error
      // stay top-level via the normal messages path below.
      if (isRunnerInnerKind(event.kind)) {
        const message: Message = {
          id: event.messageId,
          projectId: "",
          role: "agent",
          kind: event.kind,
          runId: event.runId,
          content: event.content,
          status: "completed",
          processingStatus: event.processingStatus,
          createdAt: event.createdAt,
          metadata: event.metadata ?? null,
        };
        return {
          ...state,
          runnerMessages: upsertRunnerMessage(state.runnerMessages, message),
        };
      }
      const existing = state.messages.find((m) => m.id === event.messageId);
      // SSE replay (reconnect, tab refocus, StrictMode double-mount) re-emits
      // every buffered event including the original agent_question. If the
      // user already picked an option, the existing message carries
      // `selectedOptionId` in metadata; preserve it so the picker stays in its
      // committed view instead of resurrecting as un-answered.
      const preservedSelectedOptionId =
        existing?.kind === "agent_question" &&
        existing.metadata &&
        typeof (existing.metadata as { selectedOptionId?: unknown })
          .selectedOptionId === "string"
          ? ((existing.metadata as { selectedOptionId: string })
              .selectedOptionId)
          : undefined;
      const incomingMeta = event.metadata ?? null;
      const mergedMeta =
        preservedSelectedOptionId && incomingMeta
          ? ({
              ...incomingMeta,
              selectedOptionId: preservedSelectedOptionId,
            } as AgentQuestionMetadata)
          : incomingMeta;
      const message: Message = {
        id: event.messageId,
        projectId: "",
        role: "agent",
        kind: event.kind,
        runId: event.runId,
        content: event.content,
        status: "completed",
        processingStatus: event.processingStatus,
        createdAt: event.createdAt,
        metadata: mergedMeta,
      };
      return { ...state, messages: upsertMessage(state.messages, message) };
    }

    case "message.delta": {
      // Streaming deltas render straight into chat state without ever
      // passing through the server translator's per-message sanitize
      // (sanitizeAgentText / composeAnswerMessage). Re-run the same
      // detectors here so a code identifier can't leak mid-stream even if
      // this event type is wired up to a live-token path in the future.
      const existing =
        state.messages.find((m) => m.id === event.messageId) ??
        findRunnerMessage(state.runnerMessages, event.messageId);
      const raw = (existing?.content ?? "") + event.delta;
      const content = stripUnsafeContent(raw);
      return {
        ...state,
        messages: patchMessage(state.messages, event.messageId, {
          content,
          processingStatus: "streaming",
        }),
        runnerMessages: patchRunnerMessage(state.runnerMessages, event.messageId, {
          content,
          processingStatus: "streaming",
        }),
      };
    }

    case "message.completed":
      return {
        ...state,
        messages: patchMessage(state.messages, event.messageId, {
          content: event.content,
          processingStatus: "completed",
        }),
        runnerMessages: patchRunnerMessage(state.runnerMessages, event.messageId, {
          content: event.content,
          processingStatus: "completed",
        }),
      };

    case "skeleton.update":
      if (!state.activeRun) return state;
      return {
        ...state,
        activeRun: {
          ...state.activeRun,
          status: "streaming",                           // resume from awaiting_input → streaming
          skeleton: { phase: event.phase, label: event.label, detail: event.detail },
        },
      };

    case "run.awaiting_input":                        // T031
      if (!state.activeRun) return state;
      return {
        ...state,
        activeRun: {
          ...state.activeRun,
          status: "awaiting_input",
          skeleton: null,
        },
      };

    case "option.selected": {                          // T032
      const { messageId, optionId } = event;
      const messages = event.userMessage
        ? upsertMessage(state.messages, event.userMessage)
        : state.messages;
      return {
        ...state,
        activeRun: {
          runId: event.runId,
          status: "streaming",
          skeleton: { phase: "starting", label: CLIENT_SKELETON_LABELS.starting },
          todoItems: state.activeRun?.todoItems ?? null,
        },
        messages: messages.map((m) =>
          m.id === messageId
            ? { ...m, metadata: { ...m.metadata, selectedOptionId: optionId } as AgentQuestionMetadata }
            : m,
        ),
      };
    }

    case "plan.todo_updated":
      if (!state.activeRun) return state;
      return {
        ...state,
        activeRun: { ...state.activeRun, todoItems: event.items },
      };

    case "run.completed":
      return { ...state, activeRun: null, lastRunOutcome: "completed" };
    case "run.stopped":
      return { ...state, activeRun: null, lastRunOutcome: "stopped" };

    case "run.failed":
      return finalizeFailure(state, event.error);

    case "heartbeat":
      return state;

    default:
      return state;
  }
}

function finalizeFailure(state: ChatUIState, error: StreamError): ChatUIState {
  // Surface the error on any still-streaming agent message, then clear the run.
  const messages = state.messages.map((m) =>
    m.processingStatus === "streaming"
      ? { ...m, processingStatus: "failed" as const }
      : m,
  );
  return { ...state, messages, activeRun: null, lastRunOutcome: "failed" };
}

/** Reducer for the project-level runtime channel (dev preview lifecycle). */
export function runtimeStateReducer(
  runtime: DevRuntimeUIState,
  event: RuntimeStreamEvent,
): DevRuntimeUIState {
  if (event.type === "heartbeat") return runtime;
  const dev = event as DevRuntimeEvent;
  switch (dev.type) {
    case "dev_install_started":
      return { ...runtime, status: "installing", error: null };
    case "dev_install_completed":
      return { ...runtime, status: "installed", durationMs: dev.durationMs };
    case "dev_install_failed":
      return { ...runtime, status: "error", error: dev.error };
    case "dev_starting":
      return { ...runtime, status: "starting" };
    case "dev_ready":
      return { ...runtime, status: "running", previewUrl: dev.previewUrl, previewPort: dev.port };
    case "dev_error":
      return { ...runtime, status: "error", error: dev.error, errorTier: dev.tier };
    case "dev_fix_attempt":
      return { ...runtime, status: "fixing", fixAttempt: dev.attempt, error: dev.error };
    case "dev_fix_applied":
      return { ...runtime, fixChangedFiles: dev.changedFiles };
    case "dev_fix_failed":
      return { ...runtime, status: "error", error: dev.reason };
    case "dev_stopped":
      return { ...runtime, status: "stopped", previewUrl: null, previewPort: null, error: null, errorTier: null, previewReloadRequestedAt: null, previewReloadDelayMs: null, previewReloadReason: null };
    case "preview_reload_requested":
      return {
        ...runtime,
        previewReloadRequestedAt: dev.at,
        previewReloadDelayMs: dev.delayMs,
        previewReloadReason: dev.reason,
      };
    default:
      return runtime;
  }
}
