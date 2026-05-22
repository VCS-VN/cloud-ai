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
      { name: data.name, selectedStoreSlug: data.selectedStoreSlug ?? null },
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
