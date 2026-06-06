import { AgentOrchestrator } from "@/features/ai-agent/agent/agent-orchestrator.server";
import { PromptLayerStore } from "@/features/ai-agent/agent/init-prompt-store.server";
import { loadAgentConfig } from "@/features/ai-agent/agent/agent-config";
import { createOpenAIClient } from "@/features/ai-agent/openai/openai-client.server";
import { ChatCompletionsProvider } from "@/features/ai-agent/openai/chat-completions-provider.server";
import { ProjectRunStore } from "@/features/projects/legacy/project-run-store.server";
import { ProjectFileStore } from "@/features/projects/legacy/project-file-store.server";
import { SnapshotService } from "@/features/projects/legacy/snapshot-service.server";
import { ProjectStateStore } from "@/features/projects/legacy/project-state-store.server";
import { ProcessManager } from "@/features/runtime/legacy/process-manager.server";
import { RuntimeService } from "@/features/runtime/legacy/runtime-service.server";
import { RuntimeOrchestrator } from "@/features/runtime/legacy/runtime-orchestrator.server";
import { RuntimeReconciler } from "@/features/runtime/legacy/runtime-reconciler.server";
import { CloudflareDnsClient } from "@/features/runtime/legacy/cloudflare-dns.server";
import { Pm2Driver } from "@/features/runtime/legacy/pm2-driver.server";
import { InMemoryPortAllocator } from "@/features/runtime/legacy/port-allocator.server";
import { getPreviewRuntimeConfig, isProductionPreviewEnabled } from "@/features/runtime/legacy/preview-runtime-config.server";
import { startPreviewRouterOnce } from "@/features/runtime/legacy/preview-router.server";
import { PreviewTokenService } from "@/features/runtime/legacy/preview-token-service.server";
import { presenceService } from "@/features/runtime/legacy/presence-service.server";
import {
  startPresenceSweeper,
  stopPresenceSweeper,
} from "@/features/runtime/legacy/presence-sweeper.server";
import { ErrorFixer } from "@/features/runtime/legacy/error-analyzer.server";
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
  const openAIProvider = new ChatCompletionsProvider(openAIClient);
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
