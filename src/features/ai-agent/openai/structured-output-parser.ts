import type { ZodType } from "zod";
import { redactSecrets } from "../security/secret-redactor";

export type StructuredOutputSource = "completed" | "done" | "delta" | "empty";

export function parseStructuredText<TOutput>(
  text: string,
  schema: unknown,
  schemaName: string,
  selectedSource: StructuredOutputSource,
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

  if (!isZodSchema(schema)) return parsed as TOutput;
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

function isZodSchema(schema: unknown): schema is ZodType {
  return typeof schema === "object" && schema !== null && "parse" in schema;
}
