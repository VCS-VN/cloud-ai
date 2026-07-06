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
import { ChatHistoryService } from "@/server/services/chat-history-service";
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
let agentRunReconcileStarted = false;
let skillRegistryLoadStarted = false;

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

async function ensureAgentRunReconcileOnce(agentRunRepo: PgAgentRunRepository) {
  if (agentRunReconcileStarted) return;
  agentRunReconcileStarted = true;
  try {
    const { getBuilderRunHandle } = await import(
      "@/features/agents/codex/runtime/builder-run-registry.server"
    );
    const result = await agentRunRepo.reconcileOrphanRuns({
      isLiveHandle: (runId) => getBuilderRunHandle(runId) !== undefined,
    });
    if (result.interruptedRunIds.length > 0 || result.recoveredAwaitingClarificationRunIds.length > 0) {
      console.log(
        JSON.stringify({
          event: "agent_run_boot_reconcile",
          interrupted: result.interruptedRunIds.length,
          recoveredAwaitingClarification: result.recoveredAwaitingClarificationRunIds.length,
        }),
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "agent_run_boot_reconcile_failed",
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
  }
}

async function ensureSkillRegistryLoadedOnce() {
  if (skillRegistryLoadStarted) return;
  skillRegistryLoadStarted = true;
  try {
    const { loadCodexEnv } = await import("@/server/env/codex");
    const { loadRegistry } = await import(
      "@/features/agents/codex/skills/registry.server"
    );
    const env = loadCodexEnv();
    if (!env.available) {
      console.warn(
        JSON.stringify({
          event: "skill_registry_load_skipped_codex_unavailable",
          reason: env.reason,
          missing: env.missing,
        }),
      );
      return;
    }
    const status = await loadRegistry({
      skillsRoot: env.skillsRoot,
      maxSkillChars: env.maxSkillChars,
    });
    console.log(
      JSON.stringify({
        event: "skill_registry_boot_loaded",
        skillsRoot: status.skillsRoot,
        count: status.count,
        failures: status.failures,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "skill_registry_load_failed",
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
  }
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
  void snapshotService;
  ensureRuntimeBootstrap();
  void ensureAgentRunReconcileOnce(agentRunRepo);
  void ensureSkillRegistryLoadedOnce();
  // ErrorFixer is constructed without an OpenAI provider; non-chat callers
  // that genuinely need LLM-driven fixes wire their own provider in.
  const errorFixer = new ErrorFixer({
    openAIProvider: null as never,
    coderModel: process.env.AGENT_CODER_MODEL ?? "",
  });
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
  presenceService.setRuntimeOrchestrator(runtimeOrchestrator);
  const projectService = new ProjectService(projectRepo, messageRepo, fileNodeRepo, undefined, processManager, projectStateStore, runtimeService, envWriter, runtimeOrchestrator, runStore, agentRunRepo);

  return {
    projectService,
    projectRepository: projectRepo,
    previewTokenService,
    projectRunService: new ProjectRunService(projectRepo, runStore),
    chatHistoryService: new ChatHistoryService(projectRepo, messageRepo, runStore),
    fileTreeService: new ProjectFileTreeService(projectRepo, fileNodeRepo),
  };
}
