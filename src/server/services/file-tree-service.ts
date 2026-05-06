import type { ProjectFileNode } from '@/shared/storefront-builder-types'
import { buildTree } from './project-service'
import type { ProjectFileNodeRepository, StorefrontBuilderProjectRepository } from '@/shared/storefront-builder-types'

export class StorefrontBuilderFileTreeService {
  constructor(
    private readonly projectRepository: StorefrontBuilderProjectRepository,
    private readonly fileNodeRepository: ProjectFileNodeRepository
  ) {}

  async getProjectFileTree(projectId: string, userId?: string): Promise<ProjectFileNode[]> {
    const project = await this.projectRepository.getBuilderProject(projectId, userId)
    if (!project) throw new Error('Project not found.')

    const nodes = await this.fileNodeRepository.listFileNodes(projectId, userId)
    return buildTree(nodes)
  }

  async getProjectFileNode(projectId: string, nodeId: string, userId?: string): Promise<ProjectFileNode | undefined> {
    const project = await this.projectRepository.getBuilderProject(projectId, userId)
    if (!project) throw new Error('Project not found.')
    return this.fileNodeRepository.getFileNode(projectId, nodeId, userId)
  }
}
