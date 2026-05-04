export function parseStructuredOutput(output: unknown): unknown {
  if (typeof output !== 'string') return output
  try { return JSON.parse(output) } catch { throw new Error('AI output was not valid JSON') }
}
