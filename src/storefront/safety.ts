const blockedPatterns = [
  /fake\s+review/i,
  /guaranteed\s+(cure|income|result|weight loss)/i,
  /certified\s+by\s+the\s+(fda|government|state)/i,
  /100%\s+risk[-\s]?free/i,
  /legal\s+guarantee/i,
  /doctor\s+approved/i
]

export function findContentSafetyIssues(value: unknown): string[] {
  const text = collectText(value).join('\n')
  return blockedPatterns.filter((pattern) => pattern.test(text)).map((pattern) => `Blocked unsafe claim matching ${pattern}`)
}

function collectText(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(collectText)
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectText)
  return []
}
