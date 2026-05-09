import type { AgentStreamEvent } from "../agent/agent-events";

export async function* adaptTextStreamToAgentEvents(
  stream: AsyncGenerator<{ type: "delta" | "done"; text?: string }>,
): AsyncGenerator<AgentStreamEvent> {
  for await (const event of stream) {
    if (event.type === "delta" && event.text) {
      yield { type: "assistant_message_delta", delta: event.text };
    }
  }
}
