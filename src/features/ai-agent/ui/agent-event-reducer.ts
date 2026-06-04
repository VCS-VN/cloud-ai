import type {
  AgentQuestionMetadata,
  Message,
  RunStreamEvent,
  RuntimeStreamEvent,
  RunUIState,
  SkeletonPhase,
  StreamError,
} from "@/shared/project-types";
import type { DevRuntimeEvent } from "../runtime/runtime-events";

export type DevRuntimeUIState = {
  status: "idle" | "installing" | "installed" | "starting" | "running" | "stopped" | "error" | "fixing";
  previewUrl: string | null;
  previewPort: number | null;
  error: string | null;
  errorTier: "code" | "config" | "system" | null;
  fixAttempt: number | null;
  fixChangedFiles: string[];
  durationMs: number | null;
};

export type ChatUIState = {
  messages: Message[];
  activeRun: RunUIState | null;
  runtime: DevRuntimeUIState;
};

const INITIAL_RUNTIME: DevRuntimeUIState = {
  status: "idle",
  previewUrl: null,
  previewPort: null,
  error: null,
  errorTier: null,
  fixAttempt: null,
  fixChangedFiles: [],
  durationMs: null,
};

export function createInitialChatState(messages: Message[] = []): ChatUIState {
  return { messages, activeRun: null, runtime: { ...INITIAL_RUNTIME } };
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
        activeRun: { runId: event.runId, status: "streaming", skeleton: null },
      };

    case "message.created": {
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
        metadata: event.metadata ?? null,           // T030: agent_question carries options
      };
      return { ...state, messages: upsertMessage(state.messages, message) };
    }

    case "message.delta": {
      const existing = state.messages.find((m) => m.id === event.messageId);
      const content = (existing?.content ?? "") + event.delta;
      return {
        ...state,
        messages: patchMessage(state.messages, event.messageId, {
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
        },
        messages: messages.map((m) =>
          m.id === messageId
            ? { ...m, metadata: { ...m.metadata, selectedOptionId: optionId } as AgentQuestionMetadata }
            : m,
        ),
      };
    }

    case "run.completed":
    case "run.stopped":
      return { ...state, activeRun: null };

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
  return { ...state, messages, activeRun: null };
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
    default:
      return runtime;
  }
}
