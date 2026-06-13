import { describe, expect, it, vi } from "vitest";

vi.mock("@openai/codex-sdk", () => {
  const startThread = vi.fn(() => ({ id: "thread-mock" }));
  const codexCtor = vi.fn();
  function Codex(this: unknown, options: unknown) {
    codexCtor(options);
    (this as { startThread: typeof startThread }).startThread = startThread;
  }
  return {
    Codex,
    __startThread: startThread,
    __codexCtor: codexCtor,
  };
});

import * as codexSdk from "@openai/codex-sdk";
import { createBoundedCodexThread } from "@/features/agents/codex/runtime/codex-thread.server";
import type { CodexEnvAvailable } from "@/server/env/codex";

const startThreadMock = (codexSdk as unknown as { __startThread: ReturnType<typeof vi.fn> })
  .__startThread;
const codexCtorMock = (codexSdk as unknown as { __codexCtor: ReturnType<typeof vi.fn> })
  .__codexCtor;

const env: CodexEnvAvailable = {
  available: true,
  apiKey: "test-key",
  baseUrl: "https://example.test/api",
  codexHome: "/tmp/codex",
  model: "test-model",
  skillsRoot: "/tmp/skills",
  maxSkillChars: 32000,
  llmTieBreakGap: 10,
  maxSelectedSkills: 3,
};

describe("createBoundedCodexThread — reasoning effort + sandbox wiring (R1, R2)", () => {
  it("forwards modelReasoningEffort 1:1 (low|medium|high|xhigh)", () => {
    for (const effort of ["low", "medium", "high", "xhigh"] as const) {
      startThreadMock.mockClear();
      createBoundedCodexThread({
        env,
        draftWorkspacePath: "/tmp/draft",
        modelReasoningEffort: effort,
      });
      const args = startThreadMock.mock.calls[0]?.[0];
      expect(args).toMatchObject({ modelReasoningEffort: effort });
    }
  });

  it("defaults sandboxMode to 'workspace-write'", () => {
    startThreadMock.mockClear();
    createBoundedCodexThread({ env, draftWorkspacePath: "/tmp/draft" });
    const args = startThreadMock.mock.calls[0]?.[0];
    expect(args).toMatchObject({ sandboxMode: "workspace-write" });
  });

  it("honors explicit sandboxMode override (read-only for plan turns)", () => {
    startThreadMock.mockClear();
    createBoundedCodexThread({
      env,
      draftWorkspacePath: "/tmp/draft",
      sandboxMode: "read-only",
      modelReasoningEffort: "xhigh",
    });
    const args = startThreadMock.mock.calls[0]?.[0];
    expect(args).toMatchObject({
      sandboxMode: "read-only",
      modelReasoningEffort: "xhigh",
    });
  });

  it("keeps networkAccessEnabled=false and approvalPolicy='never' regardless of options", () => {
    startThreadMock.mockClear();
    createBoundedCodexThread({
      env,
      draftWorkspacePath: "/tmp/draft",
      sandboxMode: "read-only",
    });
    const args = startThreadMock.mock.calls[0]?.[0];
    expect(args).toMatchObject({
      networkAccessEnabled: false,
      approvalPolicy: "never",
      additionalDirectories: [],
      skipGitRepoCheck: true,
    });
  });

  it("omits modelReasoningEffort when not provided (lets the SDK default apply)", () => {
    startThreadMock.mockClear();
    createBoundedCodexThread({ env, draftWorkspacePath: "/tmp/draft" });
    const args = startThreadMock.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(args?.modelReasoningEffort).toBeUndefined();
  });

  it("honors per-thread model override for lightweight repair turns", () => {
    startThreadMock.mockClear();
    createBoundedCodexThread({
      env,
      draftWorkspacePath: "/tmp/draft",
      model: "repair-model",
    });
    const args = startThreadMock.mock.calls[0]?.[0];
    expect(args).toMatchObject({ model: "repair-model" });
  });
});

describe("createBoundedCodexThread — HTTP/SSE responses transport", () => {
  type CodexCtorOptions = {
    config?: {
      model_provider?: string;
      model_providers?: Record<
        string,
        {
          wire_api?: string;
          base_url?: string;
          env_key?: string;
          requires_openai_auth?: boolean;
        }
      >;
      model_supports_reasoning_summaries?: boolean;
    };
  };

  it("forces wire_api='responses' (HTTP/SSE) because the provider has no WebSocket endpoint", () => {
    // The provider (xapi.labpinky.com) returns 404 for wss://.../v1/responses, so
    // codex's default WebSocket transport never connects. `responses` is the
    // HTTP/SSE wire API — it still streams progress, just over HTTP.
    codexCtorMock.mockClear();
    createBoundedCodexThread({ env, draftWorkspacePath: "/tmp/draft" });
    const options = codexCtorMock.mock.calls[0]?.[0] as CodexCtorOptions | undefined;
    const selected = options?.config?.model_provider;
    expect(selected).toBeTruthy();
    const provider = options?.config?.model_providers?.[selected!];
    expect(provider?.wire_api).toBe("responses");
    expect(provider?.wire_api).not.toBe("responses_websocket");
  });

  it("does not override the reserved built-in 'openai' provider id", () => {
    codexCtorMock.mockClear();
    createBoundedCodexThread({ env, draftWorkspacePath: "/tmp/draft" });
    const options = codexCtorMock.mock.calls[0]?.[0] as CodexCtorOptions | undefined;
    expect(options?.config?.model_provider).not.toBe("openai");
    expect(Object.keys(options?.config?.model_providers ?? {})).not.toContain("openai");
  });

  it("points the custom provider at the configured gateway base_url", () => {
    codexCtorMock.mockClear();
    createBoundedCodexThread({ env, draftWorkspacePath: "/tmp/draft" });
    const options = codexCtorMock.mock.calls[0]?.[0] as CodexCtorOptions | undefined;
    const selected = options?.config?.model_provider;
    const provider = options?.config?.model_providers?.[selected!];
    expect(provider?.base_url).toBe(env.baseUrl);
  });

  it("authenticates via env_key (like the working CLI), NOT requires_openai_auth", () => {
    // The regression: requires_openai_auth=true makes codex treat the provider as
    // real OpenAI and apply OpenAI reasoning-replay semantics (it requests
    // include:["reasoning.encrypted_content"]). A non-OpenAI relay doesn't echo
    // that back, so replayed reasoning arrives empty → `content is required`. The
    // working CLI config uses env_key only; match it exactly.
    codexCtorMock.mockClear();
    createBoundedCodexThread({ env, draftWorkspacePath: "/tmp/draft" });
    const options = codexCtorMock.mock.calls[0]?.[0] as CodexCtorOptions | undefined;
    const selected = options?.config?.model_provider;
    const provider = options?.config?.model_providers?.[selected!];
    expect(provider?.env_key).toBe("CODEX_API_KEY");
    expect(provider?.requires_openai_auth).toBeUndefined();
  });

  it("does NOT set model_supports_reasoning_summaries (avoids requesting encrypted reasoning replay)", () => {
    codexCtorMock.mockClear();
    createBoundedCodexThread({ env, draftWorkspacePath: "/tmp/draft" });
    const options = codexCtorMock.mock.calls[0]?.[0] as CodexCtorOptions | undefined;
    expect(options?.config?.model_supports_reasoning_summaries).toBeUndefined();
  });
});
