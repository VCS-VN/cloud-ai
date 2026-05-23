const STORE_SLUG_KEY = "VITE_STORE_SLUG";
const STORE_SLUG_LINE_PATTERN = /^\s*VITE_STORE_SLUG\s*=/;

export function applyStoreSlugToEnv(content: string, slug: string | null): string {
  const replacement = slug === null ? null : `${STORE_SLUG_KEY}=${slug}`;

  if (content === "") {
    return replacement === null ? "" : `${replacement}\n`;
  }

  const endsWithNewline = content.endsWith("\n");
  const lines = content.split("\n");
  const body = endsWithNewline ? lines.slice(0, -1) : lines;

  const targetIndex = body.findIndex((line) => STORE_SLUG_LINE_PATTERN.test(line));

  if (replacement === null) {
    if (targetIndex === -1) return content;
    const next = [...body.slice(0, targetIndex), ...body.slice(targetIndex + 1)];
    return next.join("\n") + (endsWithNewline ? "\n" : "");
  }

  if (targetIndex !== -1) {
    if (body[targetIndex] === replacement) return content;
    const next = [...body];
    next[targetIndex] = replacement;
    return next.join("\n") + (endsWithNewline ? "\n" : "");
  }

  return [...body, replacement].join("\n") + "\n";
}
