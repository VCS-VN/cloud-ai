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

  parsed = coerceKnownEnums(parsed, schemaName);

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

const STRUCTURED_THINKING_ENUMS = {
  intent: {
    allowed: new Set([
      "init_project",
      "add_feature",
      "modify_design",
      "modify_content",
      "modify_products",
      "fix_bug",
      "integrate_service",
      "explain_project",
      "unknown",
    ]),
    fallback: "unknown",
  },
  language: {
    allowed: new Set(["vi", "en", "mixed", "unknown"]),
    fallback: "unknown",
  },
  conversionGoal: {
    allowed: new Set([
      "increase_add_to_cart",
      "increase_checkout_completion",
      "improve_product_discovery",
      "increase_trust",
      "improve_brand_perception",
      "improve_mobile_ux",
      "none",
      "unknown",
    ]),
    fallback: "unknown",
  },
  recommendedNextStep: {
    allowed: new Set([
      "ask_clarification",
      "init_source",
      "create_plan",
      "generate_patch",
      "explain_only",
      "reject_or_safe_redirect",
    ]),
    fallback: "ask_clarification",
  },
  priority: {
    allowed: new Set(["low", "normal", "high"]),
    fallback: "normal",
  },
  riskLevel: {
    allowed: new Set(["low", "medium", "high"]),
    fallback: "low",
  },
  storeType: {
    allowed: new Set([
      "fashion",
      "cosmetics",
      "electronics",
      "furniture",
      "food",
      "digital",
      "general",
      "unknown",
    ]),
    fallback: "unknown",
  },
} as const;

function coerceKnownEnums(parsed: unknown, schemaName: string): unknown {
  if (schemaName !== "structured_thinking_result") return parsed;
  if (!parsed || typeof parsed !== "object") return parsed;
  const root = parsed as Record<string, unknown>;
  const coerced: string[] = [];

  coerceField(root, ["intent"], STRUCTURED_THINKING_ENUMS.intent, coerced);
  coerceField(root, ["language"], STRUCTURED_THINKING_ENUMS.language, coerced);
  coerceField(root, ["ecommerceContext", "storeType"], STRUCTURED_THINKING_ENUMS.storeType, coerced);
  coerceField(root, ["ecommerceContext", "conversionGoal"], STRUCTURED_THINKING_ENUMS.conversionGoal, coerced);
  coerceField(root, ["downstream", "recommendedNextStep"], STRUCTURED_THINKING_ENUMS.recommendedNextStep, coerced);
  coerceField(root, ["downstream", "priority"], STRUCTURED_THINKING_ENUMS.priority, coerced);
  coerceField(root, ["risk", "level"], STRUCTURED_THINKING_ENUMS.riskLevel, coerced);

  if (coerced.length > 0) {
    console.warn(JSON.stringify({
      event: "structured_output_enum_coerced",
      schemaName,
      fields: coerced,
    }));
  }
  return root;
}

function coerceField(
  root: Record<string, unknown>,
  path: readonly string[],
  spec: { allowed: ReadonlySet<string>; fallback: string },
  coerced: string[],
): void {
  let parent: Record<string, unknown> = root;
  for (let index = 0; index < path.length - 1; index += 1) {
    const next = parent[path[index]];
    if (!next || typeof next !== "object") return;
    parent = next as Record<string, unknown>;
  }
  const key = path[path.length - 1];
  const value = parent[key];
  if (typeof value !== "string" || !spec.allowed.has(value)) {
    parent[key] = spec.fallback;
    coerced.push(path.join("."));
  }
}
