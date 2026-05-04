import type { Project, Message, ProjectFileNode } from '../features/storefront-builder/types'
import type { GenerationRecord, StorefrontProject } from '../storefront/types'

export type ProjectRevision = { id: string; projectId: string; project: StorefrontProject; createdAt: string }
export type PreviewTokenRecord = { token: string; projectId: string; revisionId: string; createdAt: string }

export interface ProjectRepository {
  saveProject(project: StorefrontProject): Promise<StorefrontProject>
  getProject(id: string): Promise<StorefrontProject | undefined>
  saveRevision(revision: ProjectRevision): Promise<ProjectRevision>
  getRevision(id: string): Promise<ProjectRevision | undefined>
  addGenerationRecord(record: GenerationRecord): Promise<GenerationRecord>
  listGenerationRecords(projectId: string): Promise<GenerationRecord[]>
}

export interface PreviewTokenRepository {
  savePreviewToken(record: PreviewTokenRecord): Promise<PreviewTokenRecord>
  getPreviewToken(token: string): Promise<PreviewTokenRecord | undefined>
}

export interface StorefrontBuilderProjectRepository {
  saveBuilderProject(project: Project): Promise<Project>
  getBuilderProject(id: string): Promise<Project | undefined>
  listBuilderProjects(): Promise<Project[]>
}

export interface ProjectMessageRepository {
  saveMessage(message: Message): Promise<Message>
  updateMessageStatus(id: string, status: Message['status']): Promise<Message | undefined>
  listMessages(projectId: string): Promise<Message[]>
}

export interface ProjectFileNodeRepository {
  saveFileNode(node: ProjectFileNode): Promise<ProjectFileNode>
  getFileNode(projectId: string, nodeId: string): Promise<ProjectFileNode | undefined>
  listFileNodes(projectId: string): Promise<ProjectFileNode[]>
}

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

  async saveBuilderProject(project: Project) {
    this.builderProjects.set(project.id, project)
    return project
  }

  async getBuilderProject(id: string) {
    return this.builderProjects.get(id)
  }

  async listBuilderProjects() {
    return [...this.builderProjects.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async saveMessage(message: Message) {
    this.messages.set(message.id, message)
    return message
  }

  async updateMessageStatus(id: string, status: Message['status']) {
    const message = this.messages.get(id)
    if (!message) return undefined
    const updated = { ...message, status }
    this.messages.set(id, updated)
    return updated
  }

  async listMessages(projectId: string) {
    return [...this.messages.values()]
      .filter((message) => message.projectId === projectId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  }

  async saveFileNode(node: ProjectFileNode) {
    this.fileNodes.set(node.id, node)
    return node
  }

  async getFileNode(projectId: string, nodeId: string) {
    const node = this.fileNodes.get(nodeId)
    return node?.projectId === projectId ? node : undefined
  }

  async listFileNodes(projectId: string) {
    return [...this.fileNodes.values()]
      .filter((node) => node.projectId === projectId)
      .sort((left, right) => left.path.localeCompare(right.path))
  }
}
