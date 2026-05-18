import { describe, expect, it, vi } from "vitest";
import { compactConversation, estimateTokenCount } from "../context-compaction";
import type { ConversationMessage } from "../agentic-loop.types";

function makeMessages(count: number): ConversationMessage[] {
  const msgs: ConversationMessage[] = [
    { role: "system", content: "system prompt" },
    { role: "developer", content: "developer prompt" },
  ];
  for (let i = 0; i < count; i++) {
    msgs.push({ role: i % 2 === 0 ? "user" : "assistant", content: `message ${i}` });
  }
  return msgs;
}

describe("compactConversation", () => {
  it("preserves messages when below threshold", async () => {
    const msgs = makeMessages(5);
    const callModel = vi.fn();
    const result = await compactConversation(msgs, callModel);
    expect(result).toEqual(msgs);
    expect(callModel).not.toHaveBeenCalled();
  });

  it("summarizes with LLM when above threshold and call succeeds", async () => {
    const msgs = makeMessages(20);
    const callModel = vi.fn().mockResolvedValue("Summary of past work.");
    const result = await compactConversation(msgs, callModel);
    expect(callModel).toHaveBeenCalledOnce();
    expect(result[0]).toEqual({ role: "system", content: "system prompt" });
    expect(result[1]).toEqual({ role: "developer", content: "developer prompt" });
    expect(result[2]).toMatchObject({ role: "user", content: expect.stringContaining("Summary of past work.") });
    expect(result.length).toBeLessThan(msgs.length);
  });

  it("hard-truncates when LLM call fails (does not keep the original 150k payload)", async () => {
    const msgs = makeMessages(50);
    const callModel = vi.fn().mockRejectedValue(new Error("LLM down"));
    const result = await compactConversation(msgs, callModel);
    expect(result.length).toBeLessThan(msgs.length);
    expect(result[0]).toEqual({ role: "system", content: "system prompt" });
    expect(result[1]).toEqual({ role: "developer", content: "developer prompt" });
    const truncationMarker = result[2];
    expect("content" in truncationMarker && truncationMarker.content).toContain("Context Truncated");
  });

  it("preserves all system+developer messages even on hard truncate", async () => {
    const msgs: ConversationMessage[] = [
      { role: "system", content: "sys1" },
      { role: "developer", content: "dev1" },
      { role: "developer", content: "dev2" },
    ];
    for (let i = 0; i < 30; i++) {
      msgs.push({ role: "user", content: `m${i}` });
    }
    const callModel = vi.fn().mockRejectedValue(new Error("fail"));
    const result = await compactConversation(msgs, callModel);
    expect(result.slice(0, 3)).toEqual(msgs.slice(0, 3));
  });
});

describe("estimateTokenCount", () => {
  it("estimates by character length / 4", () => {
    const msgs: ConversationMessage[] = [{ role: "user", content: "1234567812345678" }];
    expect(estimateTokenCount(msgs)).toBe(4);
  });

  it("includes function call arguments and outputs", () => {
    const msgs: ConversationMessage[] = [
      { type: "function_call", call_id: "x", name: "foo", arguments: "1234" },
      { type: "function_call_output", call_id: "x", output: "5678" },
    ];
    expect(estimateTokenCount(msgs)).toBe(2);
  });
});
