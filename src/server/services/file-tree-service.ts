import type { ProjectFileNode } from '@/shared/project-types'
import { buildTree } from './project-service'
import type { ProjectFileNodeRepository, ProjectRepository } from '@/shared/project-types'

export class ProjectFileTreeService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly fileNodeRepository: ProjectFileNodeRepository
  ) {}

  async getProjectFileTree(projectId: string, userId?: string): Promise<ProjectFileNode[]> {
    const project = await this.projectRepository.getProject(projectId, userId)
    if (!project) throw new Error('Project not found.')

    const nodes = await this.fileNodeRepository.listFileNodes(projectId, userId)
    return buildTree(nodes)
  }

  async getProjectFileNode(projectId: string, nodeId: string, userId?: string): Promise<ProjectFileNode | undefined> {
    const project = await this.projectRepository.getProject(projectId, userId)
    if (!project) throw new Error('Project not found.')
    return this.fileNodeRepository.getFileNode(projectId, nodeId, userId)
  }
}
