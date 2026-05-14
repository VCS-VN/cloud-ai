import type { MessageStreamEvent } from "@/shared/project-types";
import type { ProjectProcessingStatus, StreamErrorCode } from "@/shared/project-types";
import { redactJson, redactSecrets } from "@/features/ai-agent/security/secret-redactor";

const activeProjectMessageStreams = new Map<string, AbortController>();
const textEncoder = new TextEncoder();

export function getProjectMessageStreamKey(
  projectId: string,
  agentMessageId: string,
) {
  return `${projectId}:${agentMessageId}`;
}

export function getProjectMessageStreamUrl(
  projectId: string,
  agentMessageId: string,
  options?: {
    reasoningEffort?: string;
    planMode?: boolean;
  },
) {
  const params = new URLSearchParams();
  if (options?.reasoningEffort) params.set("reasoningEffort", options.reasoningEffort);
  if (options?.planMode) params.set("planMode", "true");
  const query = params.toString();
  return `/api/projects/${encodeURIComponent(projectId)}/messages/${encodeURIComponent(agentMessageId)}/stream${query ? `?${query}` : ""}`;
}

export function registerProjectMessageStream(
  projectId: string,
  agentMessageId: string,
  controller: AbortController,
) {
  const key = getProjectMessageStreamKey(projectId, agentMessageId);
  const existing = activeProjectMessageStreams.get(key);
  existing?.abort();
  activeProjectMessageStreams.set(key, controller);
  return key;
}

export function releaseProjectMessageStream(
  projectId: string,
  agentMessageId: string,
  controller?: AbortController,
) {
  const key = getProjectMessageStreamKey(projectId, agentMessageId);
  if (!controller || activeProjectMessageStreams.get(key) === controller) {
    activeProjectMessageStreams.delete(key);
  }
}

export function abortProjectMessageStream(
  projectId: string,
  agentMessageId: string,
) {
  const key = getProjectMessageStreamKey(projectId, agentMessageId);
  const controller = activeProjectMessageStreams.get(key);
  if (!controller) return false;
  controller.abort();
  activeProjectMessageStreams.delete(key);
  return true;
}

export function createMessageStreamHeaders() {
  return {
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
    "X-Accel-Buffering": "no",
  };
}

export function serializeMessageStreamEvent(event: MessageStreamEvent) {
  const safeEvent = redactJson(event);
  return `event: ${safeEvent.type}\ndata: ${JSON.stringify(safeEvent)}\n\n`;
}

export function encodeMessageStreamEvent(event: MessageStreamEvent) {
  return textEncoder.encode(serializeMessageStreamEvent(event));
}

export function toStreamFailureEvent(args: {
  messageId: string;
  code: StreamErrorCode;
  message: string;
  providerResponseId?: string;
  projectProcessingStatus?: ProjectProcessingStatus;
}): MessageStreamEvent {
  return {
    type: "message.failed",
    messageId: args.messageId,
    content: "",
    processingStatus: "failed",
    projectProcessingStatus: args.projectProcessingStatus ?? "idle",
    providerResponseId: args.providerResponseId,
    error: {
      code: args.code,
      message: redactSecrets(args.message),
    },
  };
}

export function buildSampleDataClarificationMessage(reason: string) {
  return [
    "I need clarification before changing store/product sample data.",
    reason,
    "Please provide the target product id or exact value to update. Store, Product, and ProductsList structures must stay unchanged.",
  ].join(" ");
}

export function toSampleDataClarificationEvent(args: {
  messageId: string;
  reason: string;
  providerResponseId?: string;
}): MessageStreamEvent {
  return {
    type: "message.completed",
    messageId: args.messageId,
    content: buildSampleDataClarificationMessage(args.reason),
    processingStatus: "completed",
    projectProcessingStatus: "idle",
    providerResponseId: args.providerResponseId,
  };
}

export function shouldPreserveProjectMessageStream(error: { recoverable?: boolean; code?: string }) {
  return error.recoverable === true || error.code === "HUMAN_REVIEW_REQUIRED";
}
