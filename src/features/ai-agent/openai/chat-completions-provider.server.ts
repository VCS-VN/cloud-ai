import type OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions/completions";
import { redactSecrets } from "../security/secret-redactor";
import { parseStructuredText, type StructuredOutputSource } from "./structured-output-parser";
import { isSchemaRejectionError } from "./schema-error-detection";
import {
  ToolCallAccumulator,
  extractChatToolCalls,
  toChatMessages,
  toChatResponseFormat,
  toChatTools,
} from "./chat-completions-adapter";
import type { ConversationMessage } from "../agent/agentic-loop.types";
import type { CodeToolDefinition, ProjectToolResult, ProviderFunctionToolCall } from "../code-tools/code-agent-types";

export type OpenAITextStreamEvent = { type: "delta" | "done"; text?: string };

type ChatCompletionsProviderLogLevel = "info" | "error";

export type ChatCompletionsProviderLogger = (
  level: ChatCompletionsProviderLogLevel,
  event: string,
  data: Record<string, unknown>,
) => void;

export class ChatCompletionsProvider {
  constructor(
    private readonly client: OpenAI,
    private readonly logger: ChatCompletionsProviderLogger = defaultChatCompletionsProviderLogger,
  ) {}

  async createCodeToolResponse(args: {
    model: string;
    input: unknown[];
    tools: CodeToolDefinition[];
    toolChoice?: "auto" | "required";
    signal?: AbortSignal;
  }): Promise<{ raw: unknown; toolCalls: ProviderFunctionToolCall[]; outputText: string }> {
    const response = await this.client.chat.completions.create(
      {
        model: args.model,
        messages: toChatMessages(args.input as ConversationMessage[]),
        tools: toChatTools(args.tools),
        tool_choice: args.toolChoice ?? "auto",
        parallel_tool_calls: false,
      },
      args.signal ? { signal: args.signal } : undefined,
    );

    const choice = response.choices[0];
    const message = choice?.message;
    return {
      raw: response,
      outputText: typeof message?.content === "string" ? message.content : "",
      toolCalls: extractChatToolCalls((message?.tool_calls ?? []) as never),
    };
  }

  async continueCodeToolResponse(args: {
    model: string;
    input: unknown[];
    tools: CodeToolDefinition[];
    toolCall: ProviderFunctionToolCall;
    toolOutput: ProjectToolResult;
    signal?: AbortSignal;
  }): Promise<{ raw: unknown; toolCalls: ProviderFunctionToolCall[]; outputText: string }> {
    return this.createCodeToolResponse({
      model: args.model,
      input: [
        ...args.input,
        {
          type: "function_call_output",
          call_id: args.toolCall.callId,
          output: JSON.stringify(args.toolOutput),
        },
      ],
      tools: args.tools,
      toolChoice: "auto",
      signal: args.signal,
    });
  }

  async streamCodeToolResponse(args: {
    model: string;
    input: unknown[];
    tools: CodeToolDefinition[];
    toolChoice?: "auto" | "required";
    signal?: AbortSignal;
    onTextDelta?: (delta: string) => void | Promise<void>;
    reasoningEffort?: "low" | "medium" | "high";
  }): Promise<{ raw: unknown; toolCalls: ProviderFunctionToolCall[]; outputText: string }> {
    const startedAt = Date.now();
    const requestBody: Record<string, unknown> = {
      model: args.model,
      messages: toChatMessages(args.input as ConversationMessage[]),
      tools: toChatTools(args.tools),
      tool_choice: args.toolChoice ?? "auto",
      parallel_tool_calls: false,
      stream: true,
    };
    if (args.reasoningEffort) {
      requestBody.reasoning_effort = args.reasoningEffort;
    }

    this.log("info", "openai_stream_started", {
      model: args.model,
      mode: "chat_code_tool_stream",
      requestKind: "streamCodeToolResponse",
      toolCount: args.tools.length,
    });

    let outputText = "";
    let sawAnyChunk = false;
    let finishReason: string | null = null;
    const accumulator = new ToolCallAccumulator();
    let lastEventAt = Date.now();

    try {
      const stream = (await this.client.chat.completions.create(
        requestBody as never,
        args.signal ? { signal: args.signal } : undefined,
      )) as unknown as AsyncIterable<{
        choices?: Array<{
          delta?: {
            content?: string | null;
            tool_calls?: Array<{
              index?: number;
              id?: string;
              type?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
          finish_reason?: string | null;
        }>;
      }>;

      for await (const chunk of stream) {
        sawAnyChunk = true;
        lastEventAt = Date.now();
        if (args.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        const choice = chunk.choices?.[0];
        const delta = choice?.delta;
        if (delta?.content) {
          outputText += delta.content;
          if (args.onTextDelta) {
            try {
              await args.onTextDelta(delta.content);
            } catch (deltaError) {
              this.log("error", "openai_stream_delta_callback_failed", {
                error: deltaError instanceof Error ? deltaError.message : String(deltaError),
              });
            }
          }
        }
        if (delta?.tool_calls && delta.tool_calls.length > 0) {
          accumulator.consume(delta.tool_calls as never);
        }
        if (choice?.finish_reason) {
          finishReason = choice.finish_reason;
        }
      }
    } catch (error) {
      const elapsed = Date.now() - lastEventAt;
      this.log("error", "openai_stream_failed", {
        model: args.model,
        mode: "chat_code_tool_stream",
        error: error instanceof Error ? error.message : String(error),
        sawAnyChunk,
        outputTextLength: outputText.length,
        toolCallCount: accumulator.size(),
        elapsedSinceLastEventMs: elapsed,
      });
      throw error;
    }

    if (!sawAnyChunk) {
      throw new Error("Chat completions stream produced no chunks before close.");
    }

    const toolCalls = accumulator.finalize();
    this.log("info", "openai_stream_completed", {
      model: args.model,
      mode: "chat_code_tool_stream",
      requestKind: "streamCodeToolResponse",
      finishReason,
      outputTextLength: outputText.length,
      toolCallCount: toolCalls.length,
      elapsedMs: Date.now() - startedAt,
    });
    return { raw: null, toolCalls, outputText };
  }

  async parseStructured<TInput, TOutput>(args: {
    model: string;
    system: string;
    user: TInput;
    schemaName: string;
    schema: unknown;
    allowFreeFormFallback?: boolean;
  }): Promise<TOutput> {
    try {
      return await this.parseStructuredInner<TInput, TOutput>(args, { freeForm: false });
    } catch (error) {
      if (args.allowFreeFormFallback && isSchemaRejectionError(error)) {
        this.log("info", "openai_structured_falling_back_to_free_form", {
          model: args.model,
          schemaName: args.schemaName,
          reason: error instanceof Error ? error.message.slice(0, 200) : "unknown",
        });
        return this.parseStructuredInner<TInput, TOutput>(args, { freeForm: true });
      }
      throw error;
    }
  }

  private async parseStructuredInner<TInput, TOutput>(
    args: {
      model: string;
      system: string;
      user: TInput;
      schemaName: string;
      schema: unknown;
    },
    opts: { freeForm: boolean },
  ): Promise<TOutput> {
    const startedAt = Date.now();
    let chunkCount = 0;
    let accumulatedText = "";
    let selectedOutputSource: StructuredOutputSource = "empty";

    this.log("info", "openai_stream_started", {
      model: args.model,
      mode: opts.freeForm ? "chat_structured_free_form" : "chat_structured",
      requestKind: "parseStructured",
      schemaName: args.schemaName,
    });

    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `${args.system}
Return exactly one JSON value matching schema ${args.schemaName}.
The JSON value must be the schema root object itself, not nested under "${args.schemaName}", "thinking_result", "result", "data", "output", or "response".
Do not include markdown fences, prose, comments, or explanations.`,
      },
      {
        role: "user",
        content: typeof args.user === "string" ? args.user : JSON.stringify(args.user),
      },
    ];

    try {
      const requestBody: Record<string, unknown> = {
        model: args.model,
        messages,
        stream: true,
      };
      if (!opts.freeForm) {
        const responseFormat = toChatResponseFormat(args.schema, args.schemaName, true);
        if (responseFormat) {
          requestBody.response_format = responseFormat;
        }
      }
      const stream = (await this.client.chat.completions.create(requestBody as never)) as unknown as AsyncIterable<{
        choices?: Array<{ delta?: { content?: string | null; refusal?: string | null }; finish_reason?: string | null }>;
      }>;

      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        if (choice?.delta?.refusal) {
          throw new Error(`OpenAI refused structured output for ${args.schemaName}.`);
        }
        const delta = choice?.delta?.content;
        if (delta) {
          chunkCount += 1;
          accumulatedText += delta;
        }
      }

      selectedOutputSource = accumulatedText.trim() ? "delta" : "empty";
      const parsed = parseStructuredText<TOutput>(accumulatedText, args.schema, args.schemaName, selectedOutputSource);
      this.log("info", "openai_stream_completed", {
        model: args.model,
        mode: opts.freeForm ? "chat_structured_free_form" : "chat_structured",
        requestKind: "parseStructured",
        schemaName: args.schemaName,
        chunkCount,
        totalChars: accumulatedText.length,
        selectedOutputSource,
        elapsedMs: Date.now() - startedAt,
      });
      return parsed;
    } catch (error) {
      const normalized = normalizeProviderError(error, `OpenAI structured output streaming call failed for ${args.schemaName}.`);
      this.log("error", "openai_stream_failed", {
        model: args.model,
        mode: opts.freeForm ? "chat_structured_free_form" : "chat_structured",
        requestKind: "parseStructured",
        schemaName: args.schemaName,
        error: normalized.message,
        originalErrorName: error instanceof Error ? error.name : typeof error,
        originalStack: error instanceof Error && error.stack ? redactSecrets(error.stack) : undefined,
        safeOutputPreview: safePreview(accumulatedText),
        selectedOutputSource,
        chunkCount,
        elapsedMs: Date.now() - startedAt,
      });
      throw normalized;
    }
  }

  async *streamText(args: {
    model: string;
    system: string;
    input: unknown;
    signal?: AbortSignal;
  }): AsyncGenerator<OpenAITextStreamEvent> {
    const startedAt = Date.now();
    let chunkCount = 0;
    let accumulatedLength = 0;

    this.log("info", "openai_stream_started", {
      model: args.model,
      mode: "chat_text",
      requestKind: "streamText",
    });

    try {
      const stream = (await this.client.chat.completions.create(
        {
          model: args.model,
          messages: [
            { role: "system", content: args.system },
            { role: "user", content: typeof args.input === "string" ? args.input : JSON.stringify(args.input) },
          ],
          stream: true,
        },
        args.signal ? { signal: args.signal } : undefined,
      )) as unknown as AsyncIterable<{
        choices?: Array<{ delta?: { content?: string | null }; finish_reason?: string | null }>;
      }>;

      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        const delta = choice?.delta?.content;
        if (delta) {
          chunkCount += 1;
          accumulatedLength += delta.length;
          yield { type: "delta", text: delta };
        }
        if (choice?.finish_reason) {
          this.log("info", "openai_stream_completed", {
            model: args.model,
            mode: "chat_text",
            requestKind: "streamText",
            chunkCount,
            totalChars: accumulatedLength,
            finishReason: choice.finish_reason,
            elapsedMs: Date.now() - startedAt,
          });
          yield { type: "done" };
        }
      }
    } catch (error) {
      const normalized = normalizeProviderError(error, "OpenAI streaming call failed.");
      this.log("error", "openai_stream_failed", {
        model: args.model,
        mode: "chat_text",
        requestKind: "streamText",
        error: normalized.message,
        originalErrorName: error instanceof Error ? error.name : typeof error,
        originalStack: error instanceof Error && error.stack ? redactSecrets(error.stack) : undefined,
        elapsedMs: Date.now() - startedAt,
      });
      throw normalized;
    }
  }

  private log(level: ChatCompletionsProviderLogLevel, event: string, data: Record<string, unknown>) {
    this.logger(level, event, data);
  }
}

function defaultChatCompletionsProviderLogger(
  level: ChatCompletionsProviderLogLevel,
  event: string,
  data: Record<string, unknown>,
) {
  const payload = { event, ...redactLogData(data) };
  if (level === "error") {
    console.error(JSON.stringify(payload));
    return;
  }
  console.info(JSON.stringify(payload));
}

function redactLogData(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      typeof value === "string" ? redactSecrets(value) : value,
    ]),
  );
}

function safePreview(text: string) {
  return redactSecrets(text).replace(/\s+/g, " ").slice(0, 300);
}

function normalizeProviderError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return new Error(redactSecrets(message), { cause: error });
}
