const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/sk-[A-Za-z0-9_-]{8,}/g, "sk-[REDACTED]"],
  [/(api[_-]?key\s*[:=]\s*['\"]?)[^'\"\s,;}]+/gi, "$1[REDACTED]"],
  [/(token\s*[:=]\s*['\"]?)[^'\"\s,;}]+/gi, "$1[REDACTED]"],
  [/(secret\s*[:=]\s*['\"]?)[^'\"\s,;}]+/gi, "$1[REDACTED]"],
  [/(password\s*[:=]\s*['\"]?)[^'\"\s,;}]+/gi, "$1[REDACTED]"],
];

export function redactSecrets(value: string) {
  return SECRET_PATTERNS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

export function redactToolData<T>(value: T): T {
  if (typeof value === "string") return redactSecrets(value) as T;
  if (Array.isArray(value)) return value.map((entry) => redactToolData(entry)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactToolData(entry)])) as T;
  }
  return value;
}

export function truncateText(text: string, maxBytes: number) {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes <= maxBytes) return { text, truncated: false, originalBytes: bytes };
  return { text: text.slice(0, maxBytes), truncated: true, originalBytes: bytes };
}
