import { getAuthService } from "@/auth/auth-service";
import { getEpisCloudGatewayBaseUrl } from "@/auth/episcloud-config";
import type { CodexEnvAvailable } from "@/server/env/codex";

export type UserCodexEnvResult =
  | { available: true; env: CodexEnvAvailable }
  | { available: false; reason: "episcloud_not_activated" };

/**
 * Resolves the per-user Codex environment used to authenticate a builder run.
 *
 * The base env (from getCodexEnv) still supplies the global, non-secret config
 * — skillsRoot, maxSkillChars, llmTieBreakGap, maxSelectedSkills, codexHome.
 * Only the provider credentials/target change per user: the user's decrypted
 * Epis Cloud API key, the Epis Cloud AI gateway base URL, and the model the
 * user selected (falling back to the global CODEX_MODEL when none was picked).
 *
 * repairModel is cleared: the .env CODEX_REPAIR_MODEL name belongs to the old
 * relay's catalog and won't exist on Epis Cloud. createBoundedCodexThread falls
 * back to the resolved main model when the passed model is undefined.
 */
export async function resolveUserCodexEnv(input: {
  userId: string | undefined;
  baseEnv: CodexEnvAvailable;
  model: string | undefined;
}): Promise<UserCodexEnvResult> {
  if (!input.userId) return { available: false, reason: "episcloud_not_activated" };
  const apiKey = await getAuthService().getEpisCloudApiKeyForUserId(input.userId);
  if (!apiKey) return { available: false, reason: "episcloud_not_activated" };
  return {
    available: true,
    env: {
      ...input.baseEnv,
      apiKey,
      baseUrl: getEpisCloudGatewayBaseUrl(),
      model: input.model?.trim() || input.baseEnv.model,
      repairModel: undefined,
    },
  };
}
