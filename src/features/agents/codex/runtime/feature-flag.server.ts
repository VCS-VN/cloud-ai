import { loadCodexEnv, type CodexEnv } from "@/server/env/codex";

let cachedEnv: CodexEnv | null = null;

export function getCodexEnv(): CodexEnv {
  if (!cachedEnv) cachedEnv = loadCodexEnv();
  return cachedEnv;
}

export function isCodexFeatureAvailable(): boolean {
  return getCodexEnv().available;
}

export function resetCodexEnvCache(): void {
  cachedEnv = null;
}
