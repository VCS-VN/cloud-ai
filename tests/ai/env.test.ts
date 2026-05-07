import { describe, expect, it } from "vitest";
import { loadAIEnv } from "@/ai/env";

describe("loadAIEnv", () => {
  it("prefers OpenAI-specific environment variables", () => {
    expect(
      loadAIEnv({
        OPENAI_API_KEY: "sk-openai",
        OPENAI_MODEL: "gpt-5",
        OPENAI_TIMEOUT_MS: "1234",
      }),
    ).toEqual({
      provider: "openai",
      model: "gpt-5",
      apiKey: "sk-openai",
      baseUrl: undefined,
      timeoutMs: 1234,
    });
  });

  it("falls back to legacy AI variables when OpenAI variables are missing", () => {
    expect(
      loadAIEnv({
        AI_PROVIDER: "openai",
        AI_MODEL: "gpt-4.1",
        AI_API_KEY: "sk-legacy",
        AI_BASE_URL: "https://example.com",
      }),
    ).toEqual({
      provider: "openai",
      model: "gpt-4.1",
      apiKey: "sk-legacy",
      baseUrl: "https://example.com",
      timeoutMs: 60000,
    });
  });
});
