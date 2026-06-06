import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Codex feature unavailable", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.CODEX_API_KEY;
    delete process.env.CODEX_MODEL;
  });

  it("loadCodexEnv returns available:false when CODEX_API_KEY is missing", async () => {
    process.env.CODEX_MODEL = "m";
    const { loadCodexEnv } = await import("@/server/env/codex");
    const result = loadCodexEnv();
    expect(result.available).toBe(false);
    if (!result.available) expect(result.missing).toContain("CODEX_API_KEY");
  });

  it("loadCodexEnv returns available:false when CODEX_MODEL is missing", async () => {
    process.env.CODEX_API_KEY = "k";
    const { loadCodexEnv } = await import("@/server/env/codex");
    const result = loadCodexEnv();
    expect(result.available).toBe(false);
    if (!result.available) expect(result.missing).toContain("CODEX_MODEL");
  });

  it("loadCodexEnv returns available:true with both vars set", async () => {
    process.env.CODEX_API_KEY = "k";
    process.env.CODEX_MODEL = "m";
    const { loadCodexEnv } = await import("@/server/env/codex");
    const result = loadCodexEnv();
    expect(result.available).toBe(true);
  });

  it("isCodexFeatureAvailable returns false when env is invalid", async () => {
    delete process.env.CODEX_API_KEY;
    delete process.env.CODEX_MODEL;
    const { isCodexFeatureAvailable, resetCodexEnvCache } = await import(
      "@/features/agents/codex/runtime/feature-flag.server"
    );
    resetCodexEnvCache();
    expect(isCodexFeatureAvailable()).toBe(false);
  });

  it("BuilderUnavailableBanner renders the localized config_unavailable message", async () => {
    const { BuilderUnavailableBanner } = await import(
      "@/features/agents/ui/BuilderUnavailableBanner"
    );
    const { BUILDER_RUN_LOCALE_VI } = await import(
      "@/features/agents/ui/builder-run-i18n"
    );
    const node = BuilderUnavailableBanner({});
    const props = (node as unknown as { props: { children: string } }).props;
    expect(props.children).toBe(BUILDER_RUN_LOCALE_VI.failures.config_unavailable);
  });
});
