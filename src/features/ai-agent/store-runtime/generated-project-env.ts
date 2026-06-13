const API_BASE_URL_KEY = "VITE_API_BASE_URL";
const STORE_SLUG_KEY = "VITE_STORE_SLUG";
const DEFAULT_API_BASE_URL = "https://customer-api.myepis.cloud";
const API_BASE_URL_LINE_PATTERN = /^\s*VITE_API_BASE_URL\s*=/;
const STORE_SLUG_LINE_PATTERN = /^\s*VITE_STORE_SLUG\s*=/;

export function renderGeneratedProjectEnv(slug: string | null): string {
  return `${API_BASE_URL_KEY}=${DEFAULT_API_BASE_URL}
${STORE_SLUG_KEY}=${slug ?? ""}
`;
}

export function applyGeneratedProjectEnv(content: string, slug: string | null): string {
  return upsertEnvLine(
    upsertEnvLine(content, API_BASE_URL_LINE_PATTERN, `${API_BASE_URL_KEY}=${DEFAULT_API_BASE_URL}`),
    STORE_SLUG_LINE_PATTERN,
    `${STORE_SLUG_KEY}=${slug ?? ""}`,
  );
}

export function applyStoreSlugToEnv(content: string, slug: string | null): string {
  return applyGeneratedProjectEnv(content, slug);
}

function upsertEnvLine(content: string, pattern: RegExp, replacement: string): string {
  if (content === "") {
    return `${replacement}\n`;
  }

  const endsWithNewline = content.endsWith("\n");
  const lines = content.split("\n");
  const body = endsWithNewline ? lines.slice(0, -1) : lines;

  const targetIndex = body.findIndex((line) => pattern.test(line));

  if (targetIndex !== -1) {
    if (body[targetIndex] === replacement) return content;
    const next = [...body];
    next[targetIndex] = replacement;
    return next.join("\n") + (endsWithNewline ? "\n" : "");
  }

  return [...body, replacement].join("\n") + "\n";
}
