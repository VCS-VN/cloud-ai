const unsafeTags = /<\/?(script|iframe|object|embed|style|link|meta)[^>]*>/gi
const eventAttrs = /\son[a-z]+\s*=\s*(['"]).*?\1/gi
const javascriptUrls = /javascript:/gi

export function sanitizeText(value: string): string {
  return value.replace(unsafeTags, '').replace(eventAttrs, '').replace(javascriptUrls, '').trim()
}

export function sanitizeDeep<T>(value: T): T {
  if (typeof value === 'string') return sanitizeText(value) as T
  if (Array.isArray(value)) return value.map((item) => sanitizeDeep(item)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeDeep(item)])) as T
  }
  return value
}
