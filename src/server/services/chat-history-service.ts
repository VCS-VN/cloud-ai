import type { MessageCursor, MessagePage } from "@/shared/project-types";
import type {
  ProjectMessageRepository,
  ProjectRepository,
} from "@/shared/project-types";
import type { ProjectRunStore } from "@/features/projects/legacy/project-run-store.server";

/**
 * Slim service exposing only what the post-migration chat surface needs:
 *  - read chat history (GET /api/projects/$projectId/messages)
 *  - run store access for builder-runs answer + stream replay
 *
 * Replaces the legacy MessageService whose orchestrator path was removed in
 * Phase 10 of the codex SDK chat migration.
 */
export class ChatHistoryService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly messageRepository: ProjectMessageRepository,
    public readonly runStore: ProjectRunStore,
  ) {}

  async getProjectMessages(
    projectId: string,
    userId?: string,
    cursor?: MessageCursor,
  ): Promise<MessagePage> {
    const project = await this.projectRepository.getProject(projectId, userId);
    if (!project) throw new Error("Project not found.");
    return this.messageRepository.listMessages(
      projectId,
      userId,
      normalizeCursor(cursor),
    );
  }
}

function normalizeCursor(cursor?: MessageCursor): MessageCursor {
  const limit = Math.min(Math.max(cursor?.limit ?? 50, 1), 100);
  if (
    cursor?.beforeCreatedAt &&
    Number.isNaN(new Date(cursor.beforeCreatedAt).getTime())
  ) {
    throw new Error("Invalid cursor.");
  }
  return {
    beforeCreatedAt: cursor?.beforeCreatedAt,
    beforeId: cursor?.beforeId,
    limit,
  };
}
