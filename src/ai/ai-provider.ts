import type {
  Message,
  MessageDeltaEvent,
  MessageHeartbeatEvent,
  MessageStartedEvent,
  MessageTerminalEvent,
  StreamErrorCode,
} from "@/shared/project-types";

export type ProjectMessageGenerationRequest = {
  projectId: string;
  messageId: string;
  prompt: string;
  history: Array<Pick<Message, "role" | "content">>;
  planMode?: boolean;
  reasoningEffort?: ReasoningEffort;
  signal?: AbortSignal;
};

export type ReasoningEffort = "low" | "medium" | "high" | "xhigh";

export type ProjectMessageStreamHandlers = {
  onStarted?: (event: MessageStartedEvent) => Promise<void> | void;
  onDelta?: (event: MessageDeltaEvent) => Promise<void> | void;
  onCompleted?: (event: MessageTerminalEvent) => Promise<void> | void;
  onFailed?: (event: MessageTerminalEvent) => Promise<void> | void;
  onStopped?: (event: MessageTerminalEvent) => Promise<void> | void;
  onHeartbeat?: (event: MessageHeartbeatEvent) => Promise<void> | void;
};

export class AIProviderConfigurationError extends Error {
  constructor(readonly code: StreamErrorCode, message: string) {
    super(message);
    this.name = "AIProviderConfigurationError";
  }
}

export interface AIProvider {
  streamProjectMessage?(
    request: ProjectMessageGenerationRequest,
    handlers: ProjectMessageStreamHandlers,
  ): Promise<void>;
}

export {
  ChatGptProvider,
  initializeChatGptProvider,
  type ChatGptProviderInit,
  type ChatGptProviderStatus,
} from "./chatgpt-provider";
