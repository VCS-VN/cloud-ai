import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionChunk,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions/completions";
import type { ConversationMessage } from "../agent/agentic-loop.types";
import type { CodeToolDefinition, ProviderFunctionToolCall } from "../code-tools/code-agent-types";

export function toChatMessages(input: ConversationMessage[] | string, system?: string): ChatCompletionMessageParam[] {
  if (typeof input === "string") {
    const messages: ChatCompletionMessageParam[] = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: input });
    return messages;
  }

  const messages: ChatCompletionMessageParam[] = [];
  if (system) messages.push({ role: "system", content: system });

  for (const msg of input) {
    if ("role" in msg) {
      if (msg.role === "system" || msg.role === "developer") {
        messages.push({ role: "system", content: msg.content });
        continue;
      }
      if (msg.role === "user") {
        messages.push({ role: "user", content: msg.content });
        continue;
      }
      if (msg.role === "assistant") {
        messages.push({ role: "assistant", content: msg.content });
        continue;
      }
      continue;
    }
    if (msg.type === "function_call") {
      messages.push({
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: msg.call_id,
            type: "function",
            function: { name: msg.name, arguments: msg.arguments },
          },
        ],
      });
      continue;
    }
    if (msg.type === "function_call_output") {
      messages.push({
        role: "tool",
        tool_call_id: msg.call_id,
        content: msg.output,
      });
      continue;
    }
  }

  return messages;
}

export function toChatTools(tools: CodeToolDefinition[]): ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parametersJsonSchema as Record<string, unknown>,
    },
  }));
}

export function toChatResponseFormat(
  schema: unknown,
  schemaName: string,
  strict = true,
): { type: "json_schema"; json_schema: { name: string; strict: boolean; schema: Record<string, unknown> } } | undefined {
  if (!schema || typeof schema !== "object") return undefined;
  const schemaObj = schema as Record<string, unknown>;
  if (schemaObj.type === "json_schema" && typeof schemaObj.schema === "object") {
    return {
      type: "json_schema",
      json_schema: {
        name: schemaName,
        strict,
        schema: schemaObj.schema as Record<string, unknown>,
      },
    };
  }
  if ("type" in schemaObj && "properties" in schemaObj) {
    return {
      type: "json_schema",
      json_schema: { name: schemaName, strict, schema: schemaObj },
    };
  }
  return undefined;
}

type AccumulatedToolCall = {
  index: number;
  id: string;
  name: string;
  argumentChunks: string[];
};

export class ToolCallAccumulator {
  private readonly byIndex = new Map<number, AccumulatedToolCall>();
  private nextSyntheticIndex = 0;

  consume(deltaToolCalls: ChatCompletionChunk.Choice.Delta.ToolCall[] | undefined): void {
    if (!deltaToolCalls) return;
    for (const delta of deltaToolCalls) {
      const index = typeof delta.index === "number" ? delta.index : this.nextSyntheticIndex++;
      const existing = this.byIndex.get(index) ?? {
        index,
        id: "",
        name: "",
        argumentChunks: [],
      };
      if (delta.id) existing.id = delta.id;
      const fn = (delta as { function?: { name?: string; arguments?: string } }).function;
      if (fn?.name) existing.name = fn.name;
      if (typeof fn?.arguments === "string" && fn.arguments.length > 0) {
        existing.argumentChunks.push(fn.arguments);
      }
      this.byIndex.set(index, existing);
    }
  }

  finalize(): ProviderFunctionToolCall[] {
    const calls: ProviderFunctionToolCall[] = [];
    const sorted = [...this.byIndex.values()].sort((a, b) => a.index - b.index);
    for (const call of sorted) {
      if (!call.name) continue;
      calls.push({
        callId: call.id || `call_${call.index}`,
        name: call.name,
        arguments: call.argumentChunks.join(""),
      });
    }
    return calls;
  }

  size(): number {
    return this.byIndex.size;
  }
}

export function extractChatToolCalls(toolCalls: ChatCompletionMessageToolCall[]): ProviderFunctionToolCall[] {
  return toolCalls.flatMap((call) => {
    if (call.type !== "function") return [];
    const fn = (call as { function?: { name: string; arguments: string } }).function;
    if (!fn?.name) return [];
    return [
      {
        callId: call.id,
        name: fn.name,
        arguments: typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments ?? {}),
      },
    ];
  });
}
