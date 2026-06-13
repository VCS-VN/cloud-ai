import { describe, expect, it, vi } from "vitest";
import { ProjectService } from "@/server/services/project-service";
import { subscribeRuntime } from "@/server/functions/project-message-stream";
import type { Project } from "@/shared/project-types";

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    name: "Demo",
    initialPrompt: "Build a demo storefront",
    status: "ready",
    processingStatus: "idle",
    createdAt: "2026-06-15T00:00:00.000Z",
    updatedAt: "2026-06-15T00:00:00.000Z",
    selectedStoreSlug: null,
    pwa: {
      enabled: false,
      name: "Demo",
      shortName: "Demo",
      themeColor: "#000000",
      backgroundColor: "#ffffff",
      display: "standalone",
      startUrl: "/",
      scope: "/",
      offlineFallbackEnabled: false,
      icons: [],
    },
    ...overrides,
  };
}

function createService(input: {
  before: Project;
  after: Project;
  syncStoreSlug?: (projectId: string, slug: string | null) => Promise<void>;
  restartPreview?: () => Promise<void>;
}) {
  const projectRepository = {
    getProject: vi.fn().mockResolvedValue(input.before),
    updateProjectSettings: vi.fn().mockResolvedValue(input.after),
  };
  const envWriter = {
    syncStoreSlug:
      input.syncStoreSlug ??
      vi.fn().mockResolvedValue(undefined),
  };
  const runtimeOrchestrator = {
    restartPreview:
      input.restartPreview ??
      vi.fn().mockResolvedValue(undefined),
  };

  return {
    projectRepository,
    envWriter,
    runtimeOrchestrator,
    service: new ProjectService(
      projectRepository as never,
      {} as never,
      {} as never,
      {} as never,
      undefined,
      undefined,
      undefined,
      envWriter as never,
      runtimeOrchestrator as never,
    ),
  };
}

describe("ProjectService settings runtime events", () => {
  it("publishes a delayed preview reload event after store slug env sync succeeds", async () => {
    const projectId = `project-${crypto.randomUUID()}`;
    const received: string[] = [];
    const syncStoreSlug = vi.fn().mockResolvedValue(undefined);
    const restartPreview = vi.fn().mockResolvedValue(undefined);
    const { service } = createService({
      before: project({ id: projectId, selectedStoreSlug: "old-store" }),
      after: project({ id: projectId, selectedStoreSlug: "new-store" }),
      syncStoreSlug,
      restartPreview,
    });

    const unsubscribe = subscribeRuntime(projectId, (event) => {
      received.push(event.type);
    });
    try {
      await service.updateProjectSettings(projectId, {
        selectedStoreSlug: "new-store",
      });
    } finally {
      unsubscribe();
    }

    expect(syncStoreSlug).toHaveBeenCalledWith(projectId, "new-store");
    expect(restartPreview).not.toHaveBeenCalled();
    expect(received).toEqual(["preview_reload_requested"]);
  });

  it("does not publish preview reload when store slug env sync fails", async () => {
    const projectId = `project-${crypto.randomUUID()}`;
    const received: string[] = [];
    const syncStoreSlug = vi.fn().mockRejectedValue(new Error("write failed"));
    const { service } = createService({
      before: project({ id: projectId, selectedStoreSlug: "old-store" }),
      after: project({ id: projectId, selectedStoreSlug: "new-store" }),
      syncStoreSlug,
    });

    const unsubscribe = subscribeRuntime(projectId, (event) => {
      received.push(event.type);
    });
    try {
      await service.updateProjectSettings(projectId, {
        selectedStoreSlug: "new-store",
      });
    } finally {
      unsubscribe();
    }

    expect(syncStoreSlug).toHaveBeenCalledWith(projectId, "new-store");
    expect(received).toEqual([]);
  });
});
