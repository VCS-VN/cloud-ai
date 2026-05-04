import type { ProjectFileNode } from './types'
import { buildTree } from './project-service'
import type { ProjectFileNodeRepository, StorefrontBuilderProjectRepository } from '../../projects/repositories'

export class StorefrontBuilderFileTreeService {
  constructor(
    private readonly projectRepository: StorefrontBuilderProjectRepository,
    private readonly fileNodeRepository: ProjectFileNodeRepository
  ) {}

  async getProjectFileTree(projectId: string): Promise<ProjectFileNode[]> {
    const project = await this.projectRepository.getBuilderProject(projectId)
    if (!project) throw new Error('Không tìm thấy project.')

    const nodes = await this.fileNodeRepository.listFileNodes(projectId)
    return buildTree(nodes)
  }

  async getProjectFileNode(projectId: string, nodeId: string): Promise<ProjectFileNode | undefined> {
    const project = await this.projectRepository.getBuilderProject(projectId)
    if (!project) throw new Error('Không tìm thấy project.')
    return this.fileNodeRepository.getFileNode(projectId, nodeId)
  }
}
