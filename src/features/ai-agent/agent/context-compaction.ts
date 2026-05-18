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
const HARD_TRUNCATE_RECENT = 6;

export async function compactConversation(
  messages: ConversationMessage[],
  callModel: (messages: ConversationMessage[]) => Promise<string>,
): Promise<ConversationMessage[]> {
  if (messages.length <= MAX_RECENT_MESSAGES + 1) {
    return messages;
  }

  const preservedHead: ConversationMessage[] = messages.filter(
    (m) => "role" in m && (m.role === "system" || m.role === "developer"),
  );
  const preservedSet = new Set<ConversationMessage>(preservedHead);
  const tailMessages = messages.filter((m) => !preservedSet.has(m));

  const compactionMessages: ConversationMessage[] = [
    ...preservedHead,
    { role: "user", content: COMPACTION_PROMPT },
    ...tailMessages,
    { role: "user", content: "Please provide the handoff summary now." },
  ];

  try {
    const summary = await callModel(compactionMessages);
    const recentMessages = tailMessages.slice(-MAX_RECENT_MESSAGES);
    return [
      ...preservedHead,
      { role: "user", content: `[Context Compaction Summary]\n${summary}` },
      ...recentMessages,
    ];
  } catch (error) {
    console.warn(JSON.stringify({
      event: "context_compaction_failed",
      error: error instanceof Error ? error.message : String(error),
      action: "hard_truncate_fallback",
      messageCount: messages.length,
    }));
    return hardTruncate(messages, preservedHead, tailMessages);
  }
}

function hardTruncate(
  original: ConversationMessage[],
  preservedHead: ConversationMessage[],
  tailMessages: ConversationMessage[],
): ConversationMessage[] {
  const recent = tailMessages.slice(-HARD_TRUNCATE_RECENT);
  const droppedCount = original.length - preservedHead.length - recent.length;
  return [
    ...preservedHead,
    {
      role: "user",
      content: `[Context Truncated] ${droppedCount} earlier messages were dropped because automatic summarization failed. Continue from the most recent context below.`,
    },
    ...recent,
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
