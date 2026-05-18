import { describe, expect, it } from "vitest";
import {
  ToolCallAccumulator,
  extractChatToolCalls,
  toChatMessages,
  toChatResponseFormat,
  toChatTools,
} from "../chat-completions-adapter";
import type { ConversationMessage } from "../../agent/agentic-loop.types";
import type { CodeToolDefinition } from "../../code-tools/code-agent-types";

describe("toChatMessages", () => {
  it("converts string input with system prompt", () => {
    const result = toChatMessages("hello", "you are an assistant");
    expect(result).toEqual([
      { role: "system", content: "you are an assistant" },
      { role: "user", content: "hello" },
    ]);
  });

  it("maps developer role to system", () => {
    const input: ConversationMessage[] = [
      { role: "developer", content: "dev guidelines" },
      { role: "user", content: "task" },
    ];
    const result = toChatMessages(input);
    expect(result[0]).toEqual({ role: "system", content: "dev guidelines" });
    expect(result[1]).toEqual({ role: "user", content: "task" });
  });

  it("preserves system + developer messages as separate system entries", () => {
    const input: ConversationMessage[] = [
      { role: "system", content: "sys" },
      { role: "developer", content: "dev" },
      { role: "user", content: "go" },
    ];
    const result = toChatMessages(input);
    expect(result.filter((m) => m.role === "system")).toHaveLength(2);
  });

  it("converts function_call to assistant tool_calls", () => {
    const input: ConversationMessage[] = [
      { type: "function_call", call_id: "call_a", name: "foo", arguments: '{"x":1}' },
    ];
    const result = toChatMessages(input);
    expect(result[0]).toMatchObject({
      role: "assistant",
      content: null,
      tool_calls: [
        { id: "call_a", type: "function", function: { name: "foo", arguments: '{"x":1}' } },
      ],
    });
  });

  it("converts function_call_output to tool message", () => {
    const input: ConversationMessage[] = [
      { type: "function_call_output", call_id: "call_a", output: '{"ok":true}' },
    ];
    const result = toChatMessages(input);
    expect(result[0]).toEqual({
      role: "tool",
      tool_call_id: "call_a",
      content: '{"ok":true}',
    });
  });

  it("rejects unknown role values", () => {
    const input: ConversationMessage[] = [
      { role: "user", content: "go" },
    ];
    const result = toChatMessages(input);
    expect(result).toHaveLength(1);
  });
});

describe("toChatTools", () => {
  it("wraps tool definitions in chat-completion shape", () => {
    const tools: CodeToolDefinition[] = [
      {
        name: "do_thing",
        description: "Does the thing",
        parametersJsonSchema: { type: "object", properties: {} },
      } as unknown as CodeToolDefinition,
    ];
    const result = toChatTools(tools);
    expect(result).toEqual([
      {
        type: "function",
        function: {
          name: "do_thing",
          description: "Does the thing",
          parameters: { type: "object", properties: {} },
        },
      },
    ]);
  });
});

describe("toChatResponseFormat", () => {
  it("wraps a JSON schema object", () => {
    const result = toChatResponseFormat({ type: "object", properties: { foo: { type: "string" } } }, "my_schema", true);
    expect(result).toEqual({
      type: "json_schema",
      json_schema: {
        name: "my_schema",
        strict: true,
        schema: { type: "object", properties: { foo: { type: "string" } } },
      },
    });
  });

  it("unwraps pre-wrapped json_schema format", () => {
    const result = toChatResponseFormat(
      { type: "json_schema", schema: { type: "object", properties: {} } },
      "schema_name",
    );
    expect(result?.json_schema.schema).toEqual({ type: "object", properties: {} });
  });

  it("returns undefined for non-object schemas", () => {
    expect(toChatResponseFormat(null, "x")).toBeUndefined();
    expect(toChatResponseFormat("string", "x")).toBeUndefined();
  });
});

describe("ToolCallAccumulator", () => {
  it("merges name and arguments across chunks for one tool", () => {
    const acc = new ToolCallAccumulator();
    acc.consume([
      { index: 0, id: "call_xyz", type: "function", function: { name: "foo", arguments: "{" } } as never,
    ]);
    acc.consume([{ index: 0, function: { arguments: '"path":"a"' } } as never]);
    acc.consume([{ index: 0, function: { arguments: "}" } } as never]);
    const final = acc.finalize();
    expect(final).toEqual([{ callId: "call_xyz", name: "foo", arguments: '{"path":"a"}' }]);
  });

  it("handles multiple parallel tool calls by index", () => {
    const acc = new ToolCallAccumulator();
    acc.consume([
      { index: 0, id: "call_1", type: "function", function: { name: "a", arguments: "{" } } as never,
      { index: 1, id: "call_2", type: "function", function: { name: "b", arguments: "{" } } as never,
    ]);
    acc.consume([
      { index: 0, function: { arguments: "}" } } as never,
      { index: 1, function: { arguments: "}" } } as never,
    ]);
    expect(acc.finalize()).toEqual([
      { callId: "call_1", name: "a", arguments: "{}" },
      { callId: "call_2", name: "b", arguments: "{}" },
    ]);
  });

  it("uses synthetic index when chunk has no index", () => {
    const acc = new ToolCallAccumulator();
    acc.consume([
      { id: "call_a", type: "function", function: { name: "foo", arguments: "{}" } } as never,
    ]);
    expect(acc.finalize()).toEqual([{ callId: "call_a", name: "foo", arguments: "{}" }]);
  });

  it("skips tool calls without a name", () => {
    const acc = new ToolCallAccumulator();
    acc.consume([{ index: 0, id: "call_x", function: { arguments: "{}" } } as never]);
    expect(acc.finalize()).toEqual([]);
  });

  it("falls back to synthesized callId when id missing", () => {
    const acc = new ToolCallAccumulator();
    acc.consume([{ index: 7, function: { name: "foo", arguments: "{}" } } as never]);
    const final = acc.finalize();
    expect(final[0].callId).toBe("call_7");
  });
});

describe("extractChatToolCalls", () => {
  it("extracts function tool calls from assistant message", () => {
    const result = extractChatToolCalls([
      {
        id: "call_1",
        type: "function",
        function: { name: "foo", arguments: '{"a":1}' },
      } as never,
    ]);
    expect(result).toEqual([{ callId: "call_1", name: "foo", arguments: '{"a":1}' }]);
  });

  it("ignores non-function tool calls", () => {
    const result = extractChatToolCalls([
      { id: "call_x", type: "custom", custom: { name: "foo", input: "x" } } as never,
    ]);
    expect(result).toEqual([]);
  });
});
