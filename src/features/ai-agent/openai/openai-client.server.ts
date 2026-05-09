import OpenAI from "openai";
import { loadAIEnv } from "@/ai/env";

export function createOpenAIClient(env: NodeJS.ProcessEnv = process.env) {
  const config = loadAIEnv(env);
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    timeout: config.timeoutMs,
    dangerouslyAllowBrowser: process.env.NODE_ENV === "test",
  });
}
