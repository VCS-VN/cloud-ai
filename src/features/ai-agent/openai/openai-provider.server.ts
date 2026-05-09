import type OpenAI from "openai";
import type { ZodType } from "zod";
import { redactSecrets } from "../security/secret-redactor";

export type OpenAITextStreamEvent = { type: "delta" | "done"; text?: string };

type StreamingJsonSchemaTextFormat = {
  type: "json_schema";
  name: string;
  strict: boolean;
  schema: Record<string, unknown>;
};

type OpenAIProviderLogLevel = "info" | "error";
type StructuredOutputSource = "completed" | "done" | "delta" | "empty";

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
Return exactly one JSON value matching schema ${args.schemaName}. Do not include markdown fences, prose, comments, or explanations.`,
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
      const parsed = parseStructuredText<TOutput>(selectedOutput.text, args.schema, args.schemaName, selectedOutput.source, {
        validateSchema: args.schemaName !== "website_spec",
      });
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

function parseStructuredText<TOutput>(
  text: string,
  schema: unknown,
  schemaName: string,
  selectedSource: StructuredOutputSource,
  options: { validateSchema?: boolean } = {},
): TOutput {
  if (!text.trim()) {
    throw new Error(`Structured output for ${schemaName} was empty from ${selectedSource}.`);
  }

  const jsonText = recoverJsonText(text);
  if (!jsonText) {
    throw new Error(`Structured output for ${schemaName} was not valid JSON from ${selectedSource}. length=${text.length} preview=${safePreview(text)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Structured output for ${schemaName} was not valid JSON from ${selectedSource}. length=${text.length} preview=${safePreview(text)}`);
  }

  if (!isZodSchema(schema) || options.validateSchema === false) return parsed as TOutput;
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const fieldSummary = result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Structured output for ${schemaName} failed schema validation: ${fieldSummary}`);
  }
  return result.data as TOutput;
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

function recoverJsonText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (canParseJson(trimmed)) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]?.trim();
  if (fenced && canParseJson(fenced)) return fenced;

  const balanced = extractFirstBalancedJson(trimmed);
  if (balanced && canParseJson(balanced)) return balanced;
  return undefined;
}

function canParseJson(text: string) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function extractFirstBalancedJson(text: string) {
  const start = text.search(/[\[{]/);
  if (start < 0) return undefined;

  const opener = text[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === opener) depth += 1;
    if (char === closer) depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }
  return undefined;
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

function isZodSchema(schema: unknown): schema is ZodType {
  return typeof schema === "object" && schema !== null && "parse" in schema;
}

function normalizeProviderError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return new Error(redactSecrets(message), { cause: error });
}
