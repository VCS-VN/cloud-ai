export function parseStructuredOutput(output: unknown): unknown {
  if (typeof output !== 'string') return output
  try { return JSON.parse(output) } catch { throw new Error('AI output was not valid JSON') }
}

export function validateGeneratedOutputUsesSharedStoreData(output: string) {
  const hasStoreProvider = /StoreProvider|useStore/i.test(output)
  const hasPageLocalProducts = /const\s+(products|store|productsList)\s*=\s*(\[|\{)/i.test(output)
  return {
    valid: hasStoreProvider && !hasPageLocalProducts,
    hasStoreProvider,
    hasPageLocalProducts,
  }
}
