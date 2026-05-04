export type AIEnv = { provider: string; model: string; apiKey: string; baseUrl?: string; timeoutMs: number }

export function loadAIEnv(env: NodeJS.ProcessEnv = process.env): AIEnv {
  const provider = env.AI_PROVIDER
  const model = env.AI_MODEL
  const apiKey = env.AI_API_KEY
  if (!provider || !model || !apiKey) throw new Error('Missing AI provider configuration')
  return { provider, model, apiKey, baseUrl: env.AI_BASE_URL || undefined, timeoutMs: Number(env.AI_TIMEOUT_MS ?? 60000) }
}

export function redactAIEnv(config: Partial<AIEnv>): Record<string, unknown> {
  return { ...config, apiKey: config.apiKey ? '[REDACTED]' : undefined }
}
