import fs from "node:fs/promises";
import path from "node:path";

const PICSUM_ALLOWLIST_PREFIX = "https://picsum.photos/seed/";
const HTTPS_PROTOCOL = "https://";

export type ProductSampleParseSuccess = {
  ok: true;
  productId: string | null;
  storeSlug: string | null;
  total: number;
  productCount: number;
  imageViolations: string[];
};

export type ProductSampleParseFailure = {
  ok: false;
  reason:
    | "file_not_found"
    | "missing_export"
    | "non_json_compatible"
    | "shape_invalid"
    | "function_call_used"
    | "runtime_import"
    | "computed_expression"
    | "image_url_disallowed";
  detail?: string;
};

export type ProductSampleParseResult =
  | ProductSampleParseSuccess
  | ProductSampleParseFailure;

const FUNCTION_CALL_PATTERN = /[A-Za-z_$][A-Za-z0-9_$]*\s*\(/;
const TEMPLATE_LITERAL_PATTERN = /`/;

function findExpression(source: string): string | null {
  const exportMatch = source.match(
    /export\s+const\s+productsListSample\s*(?::[^=]*)?=\s*/,
  );
  if (!exportMatch) return null;
  const start = exportMatch.index! + exportMatch[0].length;
  let depth = 0;
  let i = start;
  let inString: string | null = null;
  for (; i < source.length; i++) {
    const ch = source[i];
    const prev = source[i - 1];
    if (inString) {
      if (ch === inString && prev !== "\\") inString = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    } else if (depth === 0 && (ch === ";" || ch === "\n")) {
      return source.slice(start, i);
    }
  }
  return null;
}

function isJsonCompatible(expr: string): { ok: true } | { ok: false; reason: ProductSampleParseFailure["reason"]; detail?: string } {
  if (TEMPLATE_LITERAL_PATTERN.test(expr)) {
    return { ok: false, reason: "computed_expression", detail: "template literal used" };
  }
  const stringless = expr.replace(/(['"])(?:\\.|[^\\])*?\1/g, "");
  const fnMatch = stringless.match(FUNCTION_CALL_PATTERN);
  if (fnMatch) {
    return { ok: false, reason: "function_call_used", detail: fnMatch[0] };
  }
  if (stringless.includes("import(") || stringless.includes("require(")) {
    return { ok: false, reason: "runtime_import" };
  }
  if (/[+\-*/%]\s*[A-Za-z_$]/.test(stringless)) {
    return { ok: false, reason: "computed_expression", detail: "arithmetic with identifiers" };
  }
  return { ok: true };
}

function tsToJson(expr: string): string {
  return expr
    .replace(/\bas\s+const\b/g, "")
    .replace(/(?<=[\{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '"$1":')
    .replace(/,(\s*[}\]])/g, "$1");
}

function extractImageUrls(value: unknown, into: string[]): void {
  if (typeof value === "string") {
    if (value.startsWith(HTTPS_PROTOCOL) || value.startsWith("http://")) {
      into.push(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v) => extractImageUrls(v, into));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((v) => extractImageUrls(v, into));
  }
}

export async function parseProductsSample(
  draftWorkspacePath: string,
): Promise<ProductSampleParseResult> {
  const target = path.join(
    draftWorkspacePath,
    "src/data/products.ts",
  );
  let source: string;
  try {
    source = await fs.readFile(target, "utf8");
  } catch {
    return { ok: false, reason: "file_not_found" };
  }
  const expr = findExpression(source);
  if (!expr) return { ok: false, reason: "missing_export" };

  const compat = isJsonCompatible(expr);
  if (!compat.ok) return { ok: false, reason: compat.reason, detail: compat.detail };

  let parsed: unknown;
  try {
    parsed = JSON.parse(tsToJson(expr));
  } catch (error) {
    return {
      ok: false,
      reason: "non_json_compatible",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, reason: "shape_invalid", detail: "not_object" };
  }
  const obj = parsed as { total?: unknown; data?: unknown };
  if (typeof obj.total !== "number" || !Array.isArray(obj.data)) {
    return { ok: false, reason: "shape_invalid", detail: "missing_total_or_data" };
  }
  const products = obj.data as Record<string, unknown>[];
  const first = products[0] as
    | {
        id?: unknown;
        entityId?: unknown;
        defaultModel?: { productId?: unknown };
        store?: { slug?: unknown };
      }
    | undefined;

  let productId: string | null = null;
  if (first) {
    if (typeof first.id === "string") productId = first.id;
    else if (typeof first.entityId === "string") productId = first.entityId;
    else if (
      first.defaultModel &&
      typeof first.defaultModel.productId === "string"
    )
      productId = first.defaultModel.productId;
  }

  const storeSlug =
    first && first.store && typeof first.store.slug === "string"
      ? first.store.slug
      : null;

  const urls: string[] = [];
  extractImageUrls(parsed, urls);
  const violations: string[] = [];
  for (const url of urls) {
    if (url.startsWith(PICSUM_ALLOWLIST_PREFIX)) continue;
    if (url.startsWith(HTTPS_PROTOCOL) && !url.startsWith("https://picsum.photos/")) {
      violations.push(url);
    }
  }
  if (violations.length > 0) {
    return {
      ok: false,
      reason: "image_url_disallowed",
      detail: violations[0],
    };
  }

  return {
    ok: true,
    productId,
    storeSlug,
    total: obj.total,
    productCount: products.length,
    imageViolations: [],
  };
}

export const PRODUCT_SAMPLE_RELATIVE_PATH = "src/data/products.ts";
export const PICSUM_SEED_ALLOWLIST = PICSUM_ALLOWLIST_PREFIX;
