import type { Project, Message, ProjectFileNode } from '@/features/storefront-builder/types'
import type { GenerationRecord, StorefrontProject } from '@/storefront/types'

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
  saveBuilderProject(project: Project, userId?: string): Promise<Project>
  getBuilderProject(id: string, userId?: string): Promise<Project | undefined>
  listBuilderProjects(userId?: string): Promise<Project[]>
}

export interface ProjectMessageRepository {
  saveMessage(message: Message, userId?: string): Promise<Message>
  updateMessageStatus(id: string, status: Message['status']): Promise<Message | undefined>
  listMessages(projectId: string, userId?: string): Promise<Message[]>
}

export interface ProjectFileNodeRepository {
  saveFileNode(node: ProjectFileNode, userId?: string): Promise<ProjectFileNode>
  getFileNode(projectId: string, nodeId: string, userId?: string): Promise<ProjectFileNode | undefined>
  listFileNodes(projectId: string, userId?: string): Promise<ProjectFileNode[]>
}
