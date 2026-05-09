import type OpenAI from "openai";
import { redactSecrets } from "../security/secret-redactor";
import { parseStructuredText, type StructuredOutputSource } from "./structured-output-parser";
import type { CodeToolDefinition, ProjectToolResult, ProviderFunctionToolCall } from "../code-tools/code-agent-types";
import { buildOpenAIFunctionTools } from "../code-tools/code-tool-registry.server";

export type OpenAITextStreamEvent = { type: "delta" | "done"; text?: string };

type StreamingJsonSchemaTextFormat = {
  type: "json_schema";
  name: string;
  strict: boolean;
  schema: Record<string, unknown>;
};

type OpenAIProviderLogLevel = "info" | "error";

export type OpenAIProviderLogger = (
  level: OpenAIProviderLogLevel,
  event: string,
  data: Record<string, unknown>,
) => void;

export class OpenAIProvider {
  constructor(
    private readonly client: OpenAI,
    private readonly logger: OpenAIProviderLogger = defaultOpenAIProviderLogger,
  ) {}

  async createCodeToolResponse(args: {
    model: string;
    input: unknown[];
    tools: CodeToolDefinition[];
    toolChoice?: "auto" | "required";
  }): Promise<{ raw: unknown; toolCalls: ProviderFunctionToolCall[]; outputText: string }> {
    const response = await this.client.responses.create({
      model: args.model,
      input: args.input as never,
      tools: buildOpenAIFunctionTools(args.tools) as never,
      tool_choice: args.toolChoice ?? "auto",
      parallel_tool_calls: false,
    } as never);
    return { raw: response, toolCalls: extractFunctionToolCalls(response), outputText: selectResponseOutputText(response) };
  }

  async continueCodeToolResponse(args: {
    model: string;
    input: unknown[];
    tools: CodeToolDefinition[];
    toolCall: ProviderFunctionToolCall;
    toolOutput: ProjectToolResult;
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
    });
  }

  async parseStructured<TInput, TOutput>(args: {
    model: string;
    system: string;
    user: TInput;
    schemaName: string;
    schema: unknown;
  }): Promise<TOutput> {
    const startedAt = Date.now();
    let chunkCount = 0;
    let accumulatedLength = 0;
    let deltaOutputText = "";
    let doneOutputText = "";
    let completedOutputText = "";
    let selectedOutputSource: StructuredOutputSource = "empty";

    this.log("info", "openai_stream_started", {
      model: args.model,
      mode: "structured",
      requestKind: "parseStructured",
      schemaName: args.schemaName,
    });

    try {
      const stream = await this.client.responses.create({
        model: args.model,
        instructions: `${args.system}
Return exactly one JSON value matching schema ${args.schemaName}.
The JSON value must be the schema root object itself, not nested under "${args.schemaName}", "thinking_result", "result", "data", "output", or "response".
Do not include markdown fences, prose, comments, or explanations.`,
        input: JSON.stringify(args.user),
        text: { format: createStreamingJsonSchemaTextFormat(args.schema, args.schemaName) },
        stream: true,
      });

      for await (const event of stream as AsyncIterable<OpenAIResponseStreamEvent>) {
        if (event.type) {
          this.log("info", "openai_stream_event", {
            mode: "structured",
            schemaName: args.schemaName,
            eventType: event.type,
            deltaLength: event.delta?.length ?? 0,
            chunkCount,
            accumulatedLength,
            completedLength: completedOutputText.length,
            doneLength: doneOutputText.length,
            elapsedMs: Date.now() - startedAt,
          });
        }
        if (event.type === "response.output_text.delta" && event.delta) {
          chunkCount += 1;
          deltaOutputText += event.delta;
          accumulatedLength = deltaOutputText.length;
        }
        if (event.type === "response.output_text.done" && event.text) {
          doneOutputText = event.text;
        }
        if (event.type === "response.completed" && event.response?.output_text) {
          completedOutputText = event.response.output_text;
        }
        if (event.type === "response.failed" || event.type === "response.incomplete" || event.type === "response.error") {
          throw new Error(`OpenAI structured output stream ended with ${event.type} for ${args.schemaName}.`);
        }
        if (event.type === "response.refusal.delta" || event.type === "response.refusal.done") {
          throw new Error(`OpenAI refused structured output for ${args.schemaName}.`);
        }
      }

      const selectedOutput = selectStructuredOutputText({ completedOutputText, doneOutputText, deltaOutputText });
      selectedOutputSource = selectedOutput.source;
      const parsed = parseStructuredText<TOutput>(selectedOutput.text, args.schema, args.schemaName, selectedOutput.source);
      this.log("info", "openai_stream_completed", {
        model: args.model,
        mode: "structured",
        requestKind: "parseStructured",
        schemaName: args.schemaName,
        chunkCount,
        totalChars: selectedOutput.text.length,
        deltaChars: deltaOutputText.length,
        doneChars: doneOutputText.length,
        completedChars: completedOutputText.length,
        selectedOutputSource,
        elapsedMs: Date.now() - startedAt,
      });
      return parsed;
    } catch (error) {
      const normalized = normalizeProviderError(error, `OpenAI structured output streaming call failed for ${args.schemaName}.`);
      this.log("error", "openai_stream_failed", {
        model: args.model,
        mode: "structured",
        requestKind: "parseStructured",
        schemaName: args.schemaName,
        error: normalized.message,
        originalErrorName: error instanceof Error ? error.name : typeof error,
        originalStack: error instanceof Error && error.stack ? redactSecrets(error.stack) : undefined,
        safeOutputPreview: safePreview(completedOutputText || doneOutputText || deltaOutputText),
        selectedOutputSource,
        deltaChars: deltaOutputText.length,
        doneChars: doneOutputText.length,
        completedChars: completedOutputText.length,
        elapsedMs: Date.now() - startedAt,
      });
      throw normalized;
    }
  }

  async *streamText(args: {
    model: string;
    system: string;
    input: unknown;
  }): AsyncGenerator<OpenAITextStreamEvent> {
    const startedAt = Date.now();
    let chunkCount = 0;
    let accumulatedLength = 0;

    this.log("info", "openai_stream_started", {
      model: args.model,
      mode: "text",
      requestKind: "streamText",
    });

    try {
      const stream = await this.client.responses.create({
        model: args.model,
        instructions: args.system,
        input: typeof args.input === "string" ? args.input : JSON.stringify(args.input),
        stream: true,
      });

      for await (const event of stream as AsyncIterable<{ type: string; delta?: string }>) {
        if (event.type) {
          this.log("info", "openai_stream_event", {
            mode: "text",
            eventType: event.type,
            deltaLength: event.delta?.length ?? 0,
            chunkCount,
            accumulatedLength,
            elapsedMs: Date.now() - startedAt,
          });
        }
        if (event.type === "response.output_text.delta" && event.delta) {
          chunkCount += 1;
          accumulatedLength += event.delta.length;
          yield { type: "delta", text: event.delta };
        }
        if (event.type === "response.completed") {
          this.log("info", "openai_stream_completed", {
            model: args.model,
            mode: "text",
            requestKind: "streamText",
            chunkCount,
            totalChars: accumulatedLength,
            elapsedMs: Date.now() - startedAt,
          });
          yield { type: "done" };
        }
      }
    } catch (error) {
      const normalized = normalizeProviderError(error, "OpenAI streaming call failed.");
      this.log("error", "openai_stream_failed", {
        model: args.model,
        mode: "text",
        requestKind: "streamText",
        error: normalized.message,
        originalErrorName: error instanceof Error ? error.name : typeof error,
        originalStack: error instanceof Error && error.stack ? redactSecrets(error.stack) : undefined,
        elapsedMs: Date.now() - startedAt,
      });
      throw normalized;
    }
  }

  private log(level: OpenAIProviderLogLevel, event: string, data: Record<string, unknown>) {
    this.logger(level, event, data);
  }
}

type OpenAIResponseStreamEvent = {
  type: string;
  delta?: string;
  text?: string;
  response?: { output_text?: string };
};

function defaultOpenAIProviderLogger(
  level: OpenAIProviderLogLevel,
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

function selectStructuredOutputText(args: {
  completedOutputText: string;
  doneOutputText: string;
  deltaOutputText: string;
}): { text: string; source: StructuredOutputSource } {
  if (args.completedOutputText.trim()) return { text: args.completedOutputText, source: "completed" };
  if (args.doneOutputText.trim()) return { text: args.doneOutputText, source: "done" };
  if (args.deltaOutputText.trim()) return { text: args.deltaOutputText, source: "delta" };
  return { text: "", source: "empty" };
}

function safePreview(text: string) {
  return redactSecrets(text).replace(/\s+/g, " ").slice(0, 300);
}

function createStreamingJsonSchemaTextFormat(schema: unknown, schemaName: string): StreamingJsonSchemaTextFormat {
  if (isStreamingJsonSchemaTextFormat(schema)) {
    return schema;
  }

  if (isJsonSchemaObject(schema)) {
    return {
      type: "json_schema",
      name: schemaName,
      strict: true,
      schema: schema as Record<string, unknown>,
    };
  }

  return {
    type: "json_schema",
    name: schemaName,
    strict: true,
    schema: {},
  };
}

function isStreamingJsonSchemaTextFormat(value: unknown): value is StreamingJsonSchemaTextFormat {
  return typeof value === "object" && value !== null && "type" in value && (value as { type?: unknown }).type === "json_schema";
}

function isJsonSchemaObject(value: unknown) {
  return typeof value === "object" && value !== null && "type" in value && "properties" in value;
}

function normalizeProviderError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return new Error(redactSecrets(message), { cause: error });
}

function extractFunctionToolCalls(response: unknown): ProviderFunctionToolCall[] {
  const output = Array.isArray((response as { output?: unknown }).output) ? (response as { output: unknown[] }).output : [];
  return output.flatMap((item) => {
    const candidate = item as { type?: string; name?: unknown; call_id?: unknown; id?: unknown; arguments?: unknown };
    if (candidate.type !== "function_call" || typeof candidate.name !== "string") return [];
    return [{
      callId: String(candidate.call_id ?? candidate.id ?? ""),
      name: candidate.name,
      arguments: candidate.arguments ?? {},
    }];
  });
}

function selectResponseOutputText(response: unknown) {
  const direct = (response as { output_text?: unknown }).output_text;
  if (typeof direct === "string") return direct;
  const output = Array.isArray((response as { output?: unknown }).output) ? (response as { output: unknown[] }).output : [];
  return output
    .flatMap((item) => {
      const content = (item as { content?: unknown }).content;
      return Array.isArray(content) ? content : [];
    })
    .map((content) => (content as { text?: unknown }).text)
    .filter((text): text is string => typeof text === "string")
    .join("");
}
