import {
  type DesignTokenBlock,
} from "./design-token-schema.server";

export function parseDesignTokenBlock(markdown: string): DesignTokenBlock | null {
  const source = markdown.trimStart();
  const match = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;
  return parseSimpleYamlBlock(match[1]);
}

function parseSimpleYamlBlock(source: string): DesignTokenBlock | null {
  const result: DesignTokenBlock = {};
  const lines = source.split(/\r?\n/);
  let section: "designIntent" | "tokens" | null = null;
  let tokenGroup: string | null = null;
  let tokenKey: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const indent = line.match(/^ */)?.[0].length ?? 0;
    const trimmed = line.trim();
    const pair = trimmed.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!pair) continue;
    const key = pair[1];
    const rawValue = pair[2] ?? "";
    const value = unquote(rawValue.trim());

    if (indent === 0) {
      if (key === "designIntent") {
        section = "designIntent";
        result.designIntent = {};
        tokenGroup = null;
        tokenKey = null;
      } else if (key === "tokens") {
        section = "tokens";
        result.tokens = {};
        tokenGroup = null;
        tokenKey = null;
      } else {
        section = null;
      }
      continue;
    }

    if (section === "designIntent") {
      if (indent === 2 && result.designIntent) {
        result.designIntent[key] = parseScalar(value);
      }
      continue;
    }

    if (section === "tokens") {
      if (indent === 2) {
        tokenGroup = key;
        tokenKey = null;
        result.tokens ??= {};
        result.tokens[tokenGroup] = {};
      } else if (indent === 4 && tokenGroup) {
        tokenKey = key;
        result.tokens ??= {};
        result.tokens[tokenGroup] ??= {};
        if (value) {
          result.tokens[tokenGroup][tokenKey] = value;
        } else {
          result.tokens[tokenGroup][tokenKey] = { value: "" };
        }
      } else if (indent === 6 && tokenGroup && tokenKey) {
        const entry = result.tokens?.[tokenGroup]?.[tokenKey];
        const objectEntry = typeof entry === "object" && entry ? entry : { value: typeof entry === "string" ? entry : "" };
        (objectEntry as Record<string, unknown>)[key] = parseScalar(value);
        result.tokens![tokenGroup][tokenKey] = objectEntry;
      }
    }
  }

  return result.designIntent || result.tokens ? result : null;
}

function parseScalar(value: string): unknown {
  if (value === "") return "";
  if (value.startsWith("[") && value.endsWith("]")) {
    return value.slice(1, -1).split(",").map((item) => unquote(item.trim())).filter(Boolean);
  }
  return value;
}

function unquote(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}
