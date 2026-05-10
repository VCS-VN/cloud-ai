import type { ConversationMessage } from "./agentic-loop.types";

const COMPACTION_PROMPT = `You are performing a CONTEXT CHECKPOINT COMPACTION.
Create a handoff summary for another LLM that will resume the task.

Include:
- Current progress and key decisions made
- Important context, constraints, or user preferences
- What remains to be done (clear next steps)
- Any critical data, examples, or references needed to continue

Be concise but thorough. This summary will replace the conversation history.`;

const MAX_RECENT_MESSAGES = 10;

export async function compactConversation(
  messages: ConversationMessage[],
  callModel: (messages: ConversationMessage[]) => Promise<string>,
): Promise<ConversationMessage[]> {
  if (messages.length <= MAX_RECENT_MESSAGES + 1) {
    return messages;
  }

  const systemMessages = messages.filter((m) => "role" in m && m.role === "system");
  const nonSystemMessages = messages.filter((m) => !("role" in m) || m.role !== "system");

  const compactionMessages: ConversationMessage[] = [
    ...systemMessages,
    { role: "user", content: COMPACTION_PROMPT },
    ...nonSystemMessages,
    { role: "user", content: "Please provide the handoff summary now." },
  ];

  let summary: string;
  try {
    summary = await callModel(compactionMessages);
  } catch {
    return messages;
  }

  const recentMessages = nonSystemMessages.slice(-MAX_RECENT_MESSAGES);

  return [
    ...systemMessages,
    { role: "user", content: `[Context Compaction Summary]\n${summary}` },
    ...recentMessages,
  ];
}

export function estimateTokenCount(messages: ConversationMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    if ("content" in msg && typeof msg.content === "string") {
      total += Math.ceil(msg.content.length / 4);
    }
    if ("arguments" in msg && typeof msg.arguments === "string") {
      total += Math.ceil(msg.arguments.length / 4);
    }
    if ("output" in msg && typeof msg.output === "string") {
      total += Math.ceil(msg.output.length / 4);
    }
  }
  return total;
}
