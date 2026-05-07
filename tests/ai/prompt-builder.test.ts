import { describe, expect, it } from "vitest";
import { buildProjectMessageInput } from "@/ai/prompt-builder";

describe("buildProjectMessageInput", () => {
  it("keeps the existing conversation and appends the latest prompt as the final user entry", () => {
    expect(
      buildProjectMessageInput({
        prompt: "Latest prompt",
        history: [
          { role: "user", content: "Earlier user prompt" },
          { role: "agent", content: "Earlier agent reply" },
        ],
      }),
    ).toEqual([
      { role: "user", content: "Earlier user prompt" },
      { role: "agent", content: "Earlier agent reply" },
      { role: "user", content: "Latest prompt" },
    ]);
  });

  it("drops empty messages and dedupes consecutive duplicates", () => {
    expect(
      buildProjectMessageInput({
        prompt: "",
        history: [
          { role: "user", content: "  hello  " },
          { role: "user", content: "hello" },
          { role: "agent", content: "" },
          { role: "agent", content: " reply " },
          { role: "agent", content: "reply" },
        ],
      }),
    ).toEqual([
      { role: "user", content: "hello" },
      { role: "agent", content: "reply" },
    ]);
  });

  it("does not append prompt again when it already exists as the final user entry", () => {
    expect(
      buildProjectMessageInput({
        prompt: "Latest prompt",
        history: [
          { role: "user", content: "Earlier user prompt" },
          { role: "user", content: "Latest prompt" },
        ],
      }),
    ).toEqual([
      { role: "user", content: "Earlier user prompt" },
      { role: "user", content: "Latest prompt" },
    ]);
  });

  it("keeps only the most recent 12 user turns and their following agent replies", () => {
    const history = Array.from({ length: 15 }, (_, index) => [
      { role: "user" as const, content: `user-${index + 1}` },
      { role: "agent" as const, content: `agent-${index + 1}` },
    ]).flat();

    expect(
      buildProjectMessageInput({
        prompt: "",
        history,
      }),
    ).toEqual(
      Array.from({ length: 12 }, (_, index) => {
        const turnNumber = index + 4;
        return [
          { role: "user", content: `user-${turnNumber}` },
          { role: "agent", content: `agent-${turnNumber}` },
        ];
      }).flat(),
    );
  });

  it("trims oldest history when total content exceeds the character budget but keeps the latest prompt", () => {
    const longText = "a".repeat(3000);

    const result = buildProjectMessageInput({
      prompt: "final prompt",
      history: [
        { role: "user", content: `old-1-${longText}` },
        { role: "agent", content: `old-2-${longText}` },
        { role: "user", content: `recent-${longText}` },
      ],
    });

    expect(result).toEqual([
      { role: "agent", content: `old-2-${longText}` },
      { role: "user", content: `recent-${longText}` },
      { role: "user", content: "final prompt" },
    ]);
    expect(result[result.length - 1]).toEqual({
      role: "user",
      content: "final prompt",
    });
  });
});
