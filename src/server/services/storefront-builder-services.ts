import { StorefrontBuilderFileTreeService } from "@/server/services/file-tree-service";
import { StorefrontBuilderMessageService } from "@/server/services/message-service";
import { StorefrontBuilderProjectService } from "@/server/services/project-service";
import { getDb } from "@/db/client";
import { PgProjectFileNodeRepository } from "@/server/repositories/file-node-repository";
import { PgProjectMessageRepository } from "@/server/repositories/message-repository";
import { PgStorefrontBuilderProjectRepository } from "@/server/repositories/storefront-project-repository";

export async function getStorefrontBuilderServices() {
  const db = getDb();
  const projectRepo = new PgStorefrontBuilderProjectRepository(db);
  const messageRepo = new PgProjectMessageRepository(db);
  const fileNodeRepo = new PgProjectFileNodeRepository(db);

  return {
    projectService: new StorefrontBuilderProjectService(
      projectRepo,
      messageRepo,
      fileNodeRepo,
    ),

    messageService: new StorefrontBuilderMessageService(
      projectRepo,
      messageRepo,
    ),

    fileTreeService: new StorefrontBuilderFileTreeService(
      projectRepo,
      fileNodeRepo,
    ),
  };
}
