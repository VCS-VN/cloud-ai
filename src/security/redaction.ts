const secretKeys = /api[_-]?key|token|secret|password|authorization/i
export function redactSecrets<T>(value: T): T {
  if (typeof value === 'string') return value.replace(/(api[_-]?key|token|secret|password|authorization)\s*=\s*[^\s,&]+/gi, '$1=[REDACTED]') as T
  if (Array.isArray(value)) return value.map(redactSecrets) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, secretKeys.test(key) ? '[REDACTED]' : redactSecrets(item)])) as T
  return value
}
