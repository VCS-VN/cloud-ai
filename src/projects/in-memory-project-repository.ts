import type { Project, Message, ProjectFileNode } from '@/features/storefront-builder/types'
import type { GenerationRecord, StorefrontProject } from '@/storefront/types'
import type {
  PreviewTokenRecord,
  PreviewTokenRepository,
  ProjectFileNodeRepository,
  ProjectMessageRepository,
  ProjectRepository,
  ProjectRevision,
  StorefrontBuilderProjectRepository
} from './repository-types'

export class InMemoryProjectRepository
  implements
    ProjectRepository,
    PreviewTokenRepository,
    StorefrontBuilderProjectRepository,
    ProjectMessageRepository,
    ProjectFileNodeRepository
{
  projects = new Map<string, StorefrontProject>()
  builderProjects = new Map<string, Project>()
  revisions = new Map<string, ProjectRevision>()
  records: GenerationRecord[] = []
  tokens = new Map<string, PreviewTokenRecord>()
  messages = new Map<string, Message>()
  fileNodes = new Map<string, ProjectFileNode>()

  async saveProject(project: StorefrontProject) {
    this.projects.set(project.id, project)
    return project
  }

  async getProject(id: string) {
    return this.projects.get(id)
  }

  async saveRevision(revision: ProjectRevision) {
    this.revisions.set(revision.id, revision)
    return revision
  }

  async getRevision(id: string) {
    return this.revisions.get(id)
  }

  async addGenerationRecord(record: GenerationRecord) {
    this.records.push(record)
    return record
  }

  async listGenerationRecords(projectId: string) {
    return this.records.filter((record) => record.projectId === projectId)
  }

  async savePreviewToken(record: PreviewTokenRecord) {
    this.tokens.set(record.token, record)
    return record
  }

  async getPreviewToken(token: string) {
    return this.tokens.get(token)
  }

  async saveBuilderProject(project: Project, userId?: string) {
    const scoped = userId ? { ...project, userId } : project
    this.builderProjects.set(scoped.id, scoped)
    return scoped
  }

  async getBuilderProject(id: string, userId?: string) {
    const project = this.builderProjects.get(id)
    if (!project) return undefined
    if (userId && project.userId !== userId) return undefined
    return project
  }

  async listBuilderProjects(userId?: string) {
    return [...this.builderProjects.values()]
      .filter((project) => !userId || project.userId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async saveMessage(message: Message, userId?: string) {
    const scoped = userId ? { ...message, userId } : message
    this.messages.set(scoped.id, scoped)
    return scoped
  }

  async updateMessageStatus(id: string, status: Message['status']) {
    const message = this.messages.get(id)
    if (!message) return undefined
    const updated = { ...message, status }
    this.messages.set(id, updated)
    return updated
  }

  async listMessages(projectId: string, userId?: string) {
    return [...this.messages.values()]
      .filter((message) => message.projectId === projectId && (!userId || message.userId === userId))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  }

  async saveFileNode(node: ProjectFileNode, userId?: string) {
    const scoped = userId ? { ...node, userId } : node
    this.fileNodes.set(scoped.id, scoped)
    return scoped
  }

  async getFileNode(projectId: string, nodeId: string, userId?: string) {
    const node = this.fileNodes.get(nodeId)
    if (!node || node.projectId !== projectId) return undefined
    if (userId && node.userId !== userId) return undefined
    return node
  }

  async listFileNodes(projectId: string, userId?: string) {
    return [...this.fileNodes.values()]
      .filter((node) => node.projectId === projectId && (!userId || node.userId === userId))
      .sort((left, right) => left.path.localeCompare(right.path))
  }
}
