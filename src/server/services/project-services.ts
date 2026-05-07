import { AgentRuntime } from "@/agent/agent-runtime";
import { ProjectWorkspaceService } from "@/agent/project-workspace-service";
import { ChatGptProvider } from "@/ai/chatgpt-provider";
import { loadAIEnv } from "@/ai/env";
import { ProjectFileTreeService } from "@/server/services/file-tree-service";
import { MessageService } from "@/server/services/message-service";
import { ProjectService } from "@/server/services/project-service";
import { getDb } from "@/db/client";
import { PgProjectFileNodeRepository } from "@/server/repositories/file-node-repository";
import { PgProjectMessageRepository } from "@/server/repositories/message-repository";
import { PgProjectRepository } from "@/server/repositories/project-repository";

export async function getProjectServices() {
  const db = getDb();
  const projectRepo = new PgProjectRepository(db);
  const messageRepo = new PgProjectMessageRepository(db);
  const fileNodeRepo = new PgProjectFileNodeRepository(db);
  const messageAIProviderFactory = () => new ChatGptProvider(loadAIEnv());
  const workspaceService = new ProjectWorkspaceService(fileNodeRepo);
  const agentRuntime = new AgentRuntime(workspaceService);

  return {
    projectService: new ProjectService(projectRepo, messageRepo, fileNodeRepo),

    messageService: new MessageService(
      projectRepo,
      messageRepo,
      messageAIProviderFactory,
      agentRuntime,
    ),

    fileTreeService: new ProjectFileTreeService(projectRepo, fileNodeRepo),
  };
}
