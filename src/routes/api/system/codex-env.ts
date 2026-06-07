import { createFileRoute } from "@tanstack/react-router";
import { requireServerUser } from "@/server/functions/auth";
import { loadCodexEnv, redactCodexEnv } from "@/server/env/codex";
import {
  getRegistryStatus,
  listSkills,
} from "@/features/agents/codex/skills/registry.server";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * GET /api/system/codex-env
 *
 * Reports whether codex SDK env vars are configured AND whether the skill
 * registry was successfully loaded at boot. Auth-required so it can't be hit
 * anonymously, but does NOT return the API key value (only `[REDACTED]`).
 */
export const Route = createFileRoute(
  // @ts-ignore API routes are runtime-only and omitted from routeTree.gen.ts.
  "/api/system/codex-env",
)({
  server: {
    handlers: {
      GET: async () => {
        await requireServerUser();
        const env = loadCodexEnv();
        const redacted = redactCodexEnv(env);
        const registryStatus = getRegistryStatus();
        const skills = listSkills().map((s) => s.meta.name);
        return jsonResponse(200, {
          ok: env.available && registryStatus.loaded && registryStatus.count > 0,
          env: redacted,
          skillRegistry: {
            loaded: registryStatus.loaded,
            skillsRoot: registryStatus.skillsRoot,
            count: registryStatus.count,
            bootedAt: registryStatus.bootedAt,
            failures: registryStatus.failures,
            availableSkills: skills,
          },
        });
      },
    },
  },
});
