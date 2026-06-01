import { AgentOrchestrator } from "@/features/ai-agent/agent/agent-orchestrator.server";
import { PromptLayerStore } from "@/features/ai-agent/agent/init-prompt-store.server";
import { loadAgentConfig } from "@/features/ai-agent/agent/agent-config";
import { createOpenAIClient } from "@/features/ai-agent/openai/openai-client.server";
import { OpenAIProvider } from "@/features/ai-agent/openai/openai-provider.server";
import { ProjectRunStore } from "@/features/ai-agent/project/project-run-store.server";
import { ProjectFileStore } from "@/features/ai-agent/project/project-file-store.server";
import { SnapshotService } from "@/features/ai-agent/project/snapshot-service.server";
import { ProjectStateStore } from "@/features/ai-agent/project/project-state-store.server";
import { ProcessManager } from "@/features/ai-agent/runtime/process-manager.server";
import { RuntimeService } from "@/features/ai-agent/runtime/runtime-service.server";
import { RuntimeOrchestrator } from "@/features/ai-agent/runtime/runtime-orchestrator.server";
import { RuntimeReconciler } from "@/features/ai-agent/runtime/runtime-reconciler.server";
import { CloudflareDnsClient } from "@/features/ai-agent/runtime/cloudflare-dns.server";
import { Pm2Driver } from "@/features/ai-agent/runtime/pm2-driver.server";
import { InMemoryPortAllocator } from "@/features/ai-agent/runtime/port-allocator.server";
import { getPreviewRuntimeConfig, isProductionPreviewEnabled } from "@/features/ai-agent/runtime/preview-runtime-config.server";
import { startPreviewRouterOnce } from "@/features/ai-agent/runtime/preview-router.server";
import { PreviewTokenService } from "@/features/ai-agent/runtime/preview-token-service.server";
import { presenceService } from "@/features/ai-agent/runtime/presence-service.server";
import {
  startPresenceSweeper,
  stopPresenceSweeper,
} from "@/features/ai-agent/runtime/presence-sweeper.server";
import { ErrorFixer } from "@/features/ai-agent/runtime/error-analyzer.server";
import { GeneratedProjectEnvWriter } from "@/features/ai-agent/store-runtime/generated-project-env-writer.server";
import { ProjectFileTreeService } from "@/server/services/file-tree-service";
import { MessageService } from "@/server/services/message-service";
import { ProjectService } from "@/server/services/project-service";
import { ProjectRunService } from "@/server/services/project-run-service";
import { getDb } from "@/db/client";
import { PgProjectFileNodeRepository } from "@/server/repositories/file-node-repository";
import { PgProjectMessageRepository } from "@/server/repositories/message-repository";
import { PgProjectRepository } from "@/server/repositories/project-repository";
import { PgAgentRunRepository } from "@/server/repositories/agent-run-repository";
import { PgProjectSnapshotRepository } from "@/server/repositories/project-snapshot-repository";
import { PgProjectStateRepository } from "@/server/repositories/project-state-repository";

const processManager = new ProcessManager();
const pm2Driver = new Pm2Driver();
const portAllocator = new InMemoryPortAllocator();

let runtimeBootstrapped = false;
let runtimeReconcileStarted = false;

function ensureRuntimeBootstrap() {
  if (runtimeBootstrapped) return;
  runtimeBootstrapped = true;
  startPresenceSweeper();
  const shutdown = async () => {
    stopPresenceSweeper();
    await processManager.stopAll();
    process.exit(0);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

export async function getProjectServices() {
  const db = getDb();
  const projectRepo = new PgProjectRepository(db);
  const messageRepo = new PgProjectMessageRepository(db);
  const fileNodeRepo = new PgProjectFileNodeRepository(db);
  const projectStateRepo = new PgProjectStateRepository(db);
  const agentRunRepo = new PgAgentRunRepository(db);
  const projectSnapshotRepo = new PgProjectSnapshotRepository(db);
  const projectStateStore = new ProjectStateStore(projectStateRepo);
  const runStore = new ProjectRunStore(agentRunRepo);
  const projectFileStore = new ProjectFileStore();
  const envWriter = new GeneratedProjectEnvWriter(projectFileStore);
  const previewRuntimeConfig = getPreviewRuntimeConfig();
  const createDnsClient = previewRuntimeConfig.publicHost && previewRuntimeConfig.cloudflareApiToken && previewRuntimeConfig.cloudflareZoneId && previewRuntimeConfig.cloudflareTunnelId
    ? (hostname: string) => new CloudflareDnsClient({
        apiToken: previewRuntimeConfig.cloudflareApiToken!,
        zoneId: previewRuntimeConfig.cloudflareZoneId!,
        tunnelId: previewRuntimeConfig.cloudflareTunnelId!,
        hostname,
      })
    : undefined;
  void pm2Driver;
  void portAllocator;
  const snapshotService = new SnapshotService(projectSnapshotRepo);
  const agentConfig = loadAgentConfig();
  const openAIClient = createOpenAIClient();
  const openAIProvider = new OpenAIProvider(openAIClient);
  presenceService.setProcessManager(processManager);
  ensureRuntimeBootstrap();
  const errorFixer = new ErrorFixer({ openAIProvider, coderModel: agentConfig.coderModel });
  const runtimeService = new RuntimeService({ processManager, projectStateStore, errorFixer });
  const previewTokenService = new PreviewTokenService({
    canAccessProject: async (projectId, userId) => Boolean(await projectRepo.getProject(projectId, userId)),
  });
  const runtimeOrchestrator = new RuntimeOrchestrator({ projectStateStore, pm2Driver, portAllocator, createDnsClient });
  if (!runtimeReconcileStarted) {
    runtimeReconcileStarted = true;
    const runtimeReconciler = new RuntimeReconciler({
      projectStateStore,
      pm2Driver,
      listProjects: async () => (await projectStateStore.listDevRuntimes()).map((record) => ({
        projectId: record.projectId,
        userId: record.userId,
        devRuntime: record.devRuntime,
        deleted: false,
      })),
    });
    void runtimeReconciler.reconcile().catch((error) => {
      console.error(JSON.stringify({ event: "preview_runtime_reconcile_failed", error: error instanceof Error ? error.message : "Unknown runtime reconcile error." }));
    });
  }
  if (isProductionPreviewEnabled(previewRuntimeConfig)) {
    startPreviewRouterOnce({ runtimeOrchestrator, tokenService: previewTokenService, publicHost: previewRuntimeConfig.publicHost! });
  }
  presenceService.setRuntimeStore(projectStateStore);
  const projectService = new ProjectService(projectRepo, messageRepo, fileNodeRepo, undefined, processManager, projectStateStore, runtimeService, envWriter, runtimeOrchestrator, runStore);
  const promptLayerStore = await PromptLayerStore.loadFromDisk();
  const agentOrchestrator = new AgentOrchestrator({
    projectStateStore,
    runStore,
    projectFileStore,
    snapshotService,
    openAIProvider,
    agentConfig,
    runtimeService,
    runtimeOrchestrator,
    promptLayerStore,
    selectedStoreSlugResolver: (projectId, userId) => projectService.getSelectedStoreSlug(projectId, userId),
  });

  return {
    projectService,
    previewTokenService,
    projectRunService: new ProjectRunService(projectRepo, runStore),

    messageService: new MessageService(
      projectRepo,
      messageRepo,
      agentOrchestrator,
      runStore,
    ),

    fileTreeService: new ProjectFileTreeService(projectRepo, fileNodeRepo),
  };
}
