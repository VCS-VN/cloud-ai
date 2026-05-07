import { describe, expect, it } from "vitest";
import { ChatGptProvider } from "@/ai/chatgpt-provider";

describe("ChatGptProvider", () => {
  it("maps OpenAI streaming events into app stream handlers", async () => {
    const provider = new ChatGptProvider({
      apiKey: "sk-test",
      model: "gpt-test",
      provider: "openai",
      timeoutMs: 1000,
    });
    const emitted: string[] = [];

    let capturedRequest: unknown;

    const streamEvents = [
      {
        type: "response.created",
        response: { id: "resp_123" },
      },
      {
        type: "response.output_text.delta",
        delta: "Hello",
      },
      {
        type: "response.output_text.delta",
        delta: " world",
      },
      {
        type: "response.completed",
        response: { id: "resp_123" },
      },
    ];

    (provider as unknown as {
      client: {
        responses: {
          stream: (request: unknown) => AsyncIterable<(typeof streamEvents)[number]>;
        };
      };
    }).client = {
      responses: {
        stream: (request) => {
          capturedRequest = request;
          return {
            async *[Symbol.asyncIterator]() {
              for (const event of streamEvents) {
                yield event;
              }
            },
          };
        },
      },
    };

    let completedContent = "";
    let providerResponseId = "";

    await provider.streamProjectMessage?.(
      {
        projectId: "project-1",
        messageId: "message-1",
        prompt: "Say hello",
        history: [
          { role: "user", content: "Say hello" },
          { role: "agent", content: "Hello there" },
        ],
        reasoningEffort: "high",
        planMode: true,
      },
      {
        onStarted(event) {
          emitted.push(event.type);
          providerResponseId = event.providerResponseId ?? "";
        },
        onDelta(event) {
          emitted.push(event.type);
          completedContent += event.delta;
        },
        onCompleted(event) {
          emitted.push(event.type);
          completedContent = event.content;
        },
      },
    );

    expect(emitted).toEqual([
      "message.started",
      "message.delta",
      "message.delta",
      "message.completed",
    ]);
    expect(providerResponseId).toBe("resp_123");
    expect(completedContent).toBe("Hello world");
    expect(capturedRequest).toMatchObject({
      model: "gpt-test",
      reasoning: { effort: "high" },
      stream: true,
      input: [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Say hello" }],
        },
        {
          type: "message",
          role: "assistant",
          content: "Hello there",
        },
      ],
    });
  });
});
