import { StorefrontBuilderFileTreeService } from "@/features/storefront-builder/file-tree-service";
import { StorefrontBuilderMessageService } from "@/features/storefront-builder/message-service";
import {
  seedFileNodes,
  seedMessages,
  seedProjects,
} from "@/features/storefront-builder/mock-store";
import { StorefrontBuilderProjectService } from "@/features/storefront-builder/project-service";
import { InMemoryProjectRepository } from "@/projects/in-memory-project-repository";

const repository = new InMemoryProjectRepository();
let seeded = false;

async function ensureSeedData() {
  if (seeded) return;
  seeded = true;

  for (const project of seedProjects)
    await repository.saveBuilderProject(project);
  for (const message of seedMessages) await repository.saveMessage(message);
  for (const node of seedFileNodes) await repository.saveFileNode(node);
}

export async function getStorefrontBuilderServices() {
  await ensureSeedData();
  return {
    repository,
    projectService: new StorefrontBuilderProjectService(
      repository,
      repository,
      repository,
    ),
    messageService: new StorefrontBuilderMessageService(repository, repository),
    fileTreeService: new StorefrontBuilderFileTreeService(
      repository,
      repository,
    ),
  };
}
