import type { AgentStreamEvent } from "../agent/agent-events";
import { redactJson } from "../security/secret-redactor";

const encoder = new TextEncoder();

export function encodeAgentSse(event: AgentStreamEvent): Uint8Array {
  return encoder.encode(`event: agent_event\ndata: ${JSON.stringify(redactJson(event))}\n\n`);
}

export function createAgentStreamHeaders() {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}
