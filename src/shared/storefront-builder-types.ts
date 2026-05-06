import type { GenerationRecord, StorefrontProject } from '@/storefront/types'

export type RecordStatus = 0 | 1
export type ProjectStatus = 0 | 'draft' | 'generating' | 'ready' | 'failed'
export type MessageRole = 'user' | 'agent'
export type MessageStatus = 0 | 'pending' | 'completed' | 'failed'
export type MessageProcessingStatus = 'pending' | 'completed' | 'failed'
export type ProjectFileNodeType = 'file' | 'folder'
export type PwaDisplayMode = 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser'
export type PwaIconPurpose = 'any' | 'maskable' | 'monochrome'

export type PwaIcon = {
  src: string
  sizes: string
  type: string
  purpose?: PwaIconPurpose
}

export type PwaConfig = {
  enabled: boolean
  name: string
  shortName: string
  description?: string
  themeColor: string
  backgroundColor: string
  display: PwaDisplayMode
  startUrl: string
  scope: string
  icons: PwaIcon[]
  offlineFallbackEnabled: boolean
}

export type Project = {
  id: string
  userId?: string
  name: string
  description?: string
  initialPrompt: string
  status: ProjectStatus
  updatedAt: string
  createdAt: string
  pwa: PwaConfig
}

export type Message = {
  id: string
  userId?: string
  projectId: string
  role: MessageRole
  content: string
  status: MessageStatus
  processingStatus: MessageProcessingStatus
  createdAt: string
}

export type MessageCursor = {
  beforeCreatedAt?: string
  beforeId?: string
  limit?: number
}

export type MessagePage = {
  messages: Message[]
  nextCursor?: Pick<MessageCursor, 'beforeCreatedAt' | 'beforeId'>
}

export type ProjectFileNode = {
  id: string
  userId?: string
  projectId: string
  name: string
  type: ProjectFileNodeType
  path: string
  parentId?: string | null
  children?: ProjectFileNode[]
  contentType?: string
  content?: string
  metadata?: Record<string, string | number | boolean | null>
  createdAt: string
  updatedAt: string
}

export type ProjectWorkspace = {
  project: Project
  messages: Message[]
  fileTree: ProjectFileNode[]
  selectedNode?: ProjectFileNode
}

export type WorkspaceResult = {
  projects: Project[]
  selectedProjectId?: string
  workspace?: ProjectWorkspace
}

export type ProjectRevision = {
  id: string
  projectId: string
  project: StorefrontProject
  createdAt: string
}

export type PreviewTokenRecord = {
  token: string
  projectId: string
  revisionId: string
  createdAt: string
}

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
  deleteBuilderProject(id: string, userId?: string): Promise<boolean>
}

export interface ProjectMessageRepository {
  saveMessage(message: Message, userId?: string): Promise<Message>
  updateMessageStatus(id: string, status: Message['status']): Promise<Message | undefined>
  updateMessageProcessingStatus(id: string, status: Message['processingStatus']): Promise<Message | undefined>
  bulkUpdateMessageStatusByProject(projectId: string, status: Message['status'], userId?: string): Promise<number>
  listMessages(projectId: string, userId?: string, cursor?: MessageCursor): Promise<MessagePage>
}

export interface ProjectFileNodeRepository {
  saveFileNode(node: ProjectFileNode, userId?: string): Promise<ProjectFileNode>
  getFileNode(projectId: string, nodeId: string, userId?: string): Promise<ProjectFileNode | undefined>
  listFileNodes(projectId: string, userId?: string): Promise<ProjectFileNode[]>
}
