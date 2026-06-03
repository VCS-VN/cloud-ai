export type AIEnv = {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  timeoutMs: number;
};

function getFirstDefined(...values: Array<string | undefined>) {
  return values.find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
}

export function loadAIEnv(env: NodeJS.ProcessEnv = process.env): AIEnv {
  const provider = getFirstDefined(
    env.OPENAI_API_KEY ? "openai" : undefined,
    env.AI_PROVIDER,
    "openai",
  );

  const model = getFirstDefined(env.OPENAI_MODEL, env.AI_MODEL);
  const apiKey = getFirstDefined(env.AI_PROVIDER_API_KEY, env.OPENAI_API_KEY, env.AI_API_KEY);
  if (!provider || !model || !apiKey)
    throw new Error("Missing AI provider configuration");
  const baseUrl = getFirstDefined(env.AI_PROVIDER_BASE_URL, env.OPENAI_BASE_URL, env.AI_BASE_URL);
  const timeoutMs = Number(
    getFirstDefined(env.OPENAI_TIMEOUT_MS, env.AI_TIMEOUT_MS) ?? 60000,
  );
  return { provider, model, apiKey, baseUrl: baseUrl || undefined, timeoutMs };
}

export function redactAIEnv(config: Partial<AIEnv>): Record<string, unknown> {
  return { ...config, apiKey: config.apiKey ? "[REDACTED]" : undefined };
}
