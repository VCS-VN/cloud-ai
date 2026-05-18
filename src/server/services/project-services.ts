import { AgentRuntime } from "@/agent/agent-runtime";
import { ProjectWorkspaceService } from "@/agent/project-workspace-service";
import { AgentOrchestrator } from "@/features/ai-agent/agent/agent-orchestrator.server";
import { loadAgentConfig } from "@/features/ai-agent/agent/agent-config";
import { createOpenAIClient } from "@/features/ai-agent/openai/openai-client.server";
import { OpenAIProvider } from "@/features/ai-agent/openai/openai-provider.server";
import { ProjectRunStore } from "@/features/ai-agent/project/project-run-store.server";
import { ProjectFileStore } from "@/features/ai-agent/project/project-file-store.server";
import { SnapshotService } from "@/features/ai-agent/project/snapshot-service.server";
import { ProjectStateStore } from "@/features/ai-agent/project/project-state-store.server";
import { ProcessManager } from "@/features/ai-agent/runtime/process-manager.server";
import { RuntimeService } from "@/features/ai-agent/runtime/runtime-service.server";
import { presenceService } from "@/features/ai-agent/runtime/presence-service.server";
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

export async function getProjectServices() {
  const db = getDb();
  const projectRepo = new PgProjectRepository(db);
  const messageRepo = new PgProjectMessageRepository(db);
  const fileNodeRepo = new PgProjectFileNodeRepository(db);
  const projectStateRepo = new PgProjectStateRepository(db);
  const agentRunRepo = new PgAgentRunRepository(db);
  const projectSnapshotRepo = new PgProjectSnapshotRepository(db);
  const workspaceService = new ProjectWorkspaceService(fileNodeRepo);
  const agentRuntime = new AgentRuntime(workspaceService);
  const projectStateStore = new ProjectStateStore(projectStateRepo);
  const runStore = new ProjectRunStore(agentRunRepo);
  const projectFileStore = new ProjectFileStore();
  const envWriter = new GeneratedProjectEnvWriter(projectFileStore);
  const snapshotService = new SnapshotService(projectSnapshotRepo);
  const agentConfig = loadAgentConfig();
  const openAIClient = createOpenAIClient();
  const openAIProvider = new OpenAIProvider(openAIClient);
  presenceService.setProcessManager(processManager);
  const errorFixer = new ErrorFixer({ openAIProvider, coderModel: agentConfig.coderModel });
  const runtimeService = new RuntimeService({ processManager, projectStateStore, errorFixer });
  presenceService.setRuntimeStore(projectStateStore);
  const projectService = new ProjectService(projectRepo, messageRepo, fileNodeRepo, undefined, processManager, projectStateStore, runtimeService, envWriter);
  const agentOrchestrator = new AgentOrchestrator({
    projectStateStore,
    runStore,
    projectFileStore,
    snapshotService,
    openAIProvider,
    agentConfig,
    runtimeService,
    selectedStoreSlugResolver: (projectId, userId) => projectService.getSelectedStoreSlug(projectId, userId),
  });

  return {
    projectService,
    projectRunService: new ProjectRunService(projectRepo, runStore),

    messageService: new MessageService(
      projectRepo,
      messageRepo,
      agentRuntime,
      agentOrchestrator,
    ),

    fileTreeService: new ProjectFileTreeService(projectRepo, fileNodeRepo),
  };
}
