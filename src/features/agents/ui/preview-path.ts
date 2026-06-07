export type PreviewPathResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

const FULL_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

export function normalizePreviewPath(input: string): PreviewPathResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, path: "/" };
  if (FULL_URL_PATTERN.test(trimmed) || trimmed.startsWith("//")) {
    return {
      ok: false,
      error: "Enter a path only, like /products or /products?q=shirts.",
    };
  }
  return {
    ok: true,
    path: trimmed.startsWith("/") ? trimmed : `/${trimmed}`,
  };
}

export function buildPreviewUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
