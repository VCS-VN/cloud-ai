import { InMemoryProjectRepository } from '../../projects/repositories'
import { seedFileNodes, seedMessages, seedProjects } from './mock-store'
import { StorefrontBuilderFileTreeService } from './file-tree-service'
import { StorefrontBuilderMessageService } from './message-service'
import { StorefrontBuilderProjectService } from './project-service'

const repository = new InMemoryProjectRepository()
let seeded = false

async function ensureSeedData() {
  if (seeded) return
  seeded = true

  for (const project of seedProjects) await repository.saveBuilderProject(project)
  for (const message of seedMessages) await repository.saveMessage(message)
  for (const node of seedFileNodes) await repository.saveFileNode(node)
}

export async function getStorefrontBuilderServices() {
  await ensureSeedData()
  return {
    repository,
    projectService: new StorefrontBuilderProjectService(repository, repository, repository),
    messageService: new StorefrontBuilderMessageService(repository, repository),
    fileTreeService: new StorefrontBuilderFileTreeService(repository, repository)
  }
}
