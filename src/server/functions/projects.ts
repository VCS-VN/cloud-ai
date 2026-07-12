import { createServerFn } from "@tanstack/react-start";
import { requireServerUser } from "./auth";
import { getAuthService } from "@/auth/auth-service";
import { MerchantGatewayClient } from "@/auth/oauth-client.server";
async function loadProjectServices() {
  return (await import('../services/project-services')).getProjectServices();
}


export const listProjects = createServerFn({ method: "GET" }).handler(
  async () => {
    const user = await requireServerUser();
    const { projectService } = await loadProjectServices();
    return projectService.listProjects(user.id);
  },
);

export const getProjectWorkspace = createServerFn({ method: "GET" })
  .inputValidator((data: { projectId?: string } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    const user = await requireServerUser();
    const { projectService } = await loadProjectServices();
    return projectService.getWorkspace(data.projectId, user.id);
  });

export const createProjectFromPrompt = createServerFn({ method: "POST" })
  .inputValidator((data: { prompt: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireServerUser();

    const { projectService } = await loadProjectServices();

    return projectService.createProjectFromPrompt(data.prompt, user.id);
  });

export const deleteProject = createServerFn({ method: "POST" })
  .inputValidator((data: { projectId: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireServerUser();

    const { projectService } = await loadProjectServices();

    return projectService.deleteProject(data.projectId, user.id);
  });

export const updateProjectSettings = createServerFn({ method: "POST" })
  .inputValidator((data: { projectId: string; name?: string; selectedStoreSlug?: string | null }) => data)
  .handler(async ({ data }) => {
    const user = await requireServerUser();

    const { projectService } = await loadProjectServices();

    return projectService.updateProjectSettings(
      data.projectId,
      {
        name: data.name,
        ...("selectedStoreSlug" in data ? { selectedStoreSlug: data.selectedStoreSlug ?? null } : {}),
      },
      user.id,
    );
  });

export const getStores = createServerFn({ method: "GET" })
  .inputValidator((data: { page?: number; limit?: number; search?: string } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    const apiKey = await getAuthService().requireMerchantApiKey();
    return new MerchantGatewayClient().getStores({
      apiKey,
      page: data.page,
      limit: data.limit ?? 10,
      search: data.search,
    });
  });

export const generateRetailSuggestions = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      storeName?: string;
      recentUserPrompt?: string;
      recentAgentAnswer?: string;
      generatedPageSlugs?: string[];
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireServerUser();
    try {
      const { getCodexEnv } = await import(
        "@/features/agents/codex/runtime/feature-flag.server"
      );
      const env = getCodexEnv();
      if (!env.available) return { suggestions: [] as string[] };

      const [{ runResponsesTurn }, retailSuggestions] = await Promise.all([
        import("@/features/agents/codex/runtime/responses-http-client.server"),
        import("@/features/agents/codex/runtime/retail-suggestions.server"),
      ]);

      const prompt = retailSuggestions.buildRetailSuggestionsPrompt({
        storeName: data.storeName,
        recentUserPrompt: data.recentUserPrompt,
        recentAgentAnswer: data.recentAgentAnswer,
        generatedPageSlugs: data.generatedPageSlugs,
      });

      const result = await retailSuggestions.generateRetailSuggestions({
        runTurn: () =>
          runResponsesTurn({ env, prompt, reasoningEffort: "low" }),
      });

      return { suggestions: result.ok ? result.suggestions : ([] as string[]) };
    } catch {
      // Suggestions are a non-critical enhancement — never surface a failure to
      // the client; an empty list simply hides the chips.
      return { suggestions: [] as string[] };
    }
  });
