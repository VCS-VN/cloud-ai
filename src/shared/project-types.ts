import type { DevRuntime } from "@/features/ai-agent/project/project-state.schema";

export type RecordStatus = 0 | 1
export type ProjectStatus = 0 | 'draft' | 'generating' | 'ready' | 'failed'
export type MessageRole = 'user' | 'agent'
export type MessageStatus = 0 | 'pending' | 'completed' | 'failed'
export type ProjectProcessingStatus = 'idle' | 'processing'
export type MessageProcessingStatus = 'pending' | 'streaming' | 'completed' | 'failed' | 'stopped'
export type ProjectFileNodeType = 'file' | 'folder'
export type PwaDisplayMode = 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser'
export type PwaIconPurpose = 'any' | 'maskable' | 'monochrome'
export type StreamEventType =
  | 'message.started'
  | 'message.delta'
  | 'message.completed'
  | 'message.failed'
  | 'message.stopped'
  | 'heartbeat'
export type StreamErrorCode =
  | 'UNAUTHENTICATED'
  | 'PROJECT_NOT_FOUND'
  | 'PROMPT_EMPTY'
  | 'PROJECT_ALREADY_PROCESSING'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_STREAM_FAILED'
  | 'MESSAGE_NOT_FOUND'
  | 'STOP_NOT_ALLOWED'

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
  processingStatus: ProjectProcessingStatus
  activeAgentMessageId?: string
  processingStartedAt?: string
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
  parentMessageId?: string
  provider?: string
  providerResponseId?: string
  errorMessage?: string
  startedAt?: string
  completedAt?: string
  updatedAt?: string
  createdAt: string
}

export type AgentMessageChunk = {
  id: string
  projectId: string
  messageId: string
  userId?: string
  sequence: number
  content: string
  providerEventType?: string
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
  total: number
}

export type StreamError = {
  code: StreamErrorCode
  message: string
}

export type ComposerReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh'

export type MessageStreamState = {
  project: Pick<Project, 'id' | 'processingStatus' | 'activeAgentMessageId'>
  userMessage: Message
  agentMessage: Message
  stream: {
    url: string
  }
}

export type MessageStartedEvent = {
  type: 'message.started'
  projectId: string
  messageId: string
  processingStatus: Extract<MessageProcessingStatus, 'streaming'>
  providerResponseId?: string
}

export type MessageDeltaEvent = {
  type: 'message.delta'
  messageId: string
  sequence: number
  delta: string
}

export type MessageTerminalEvent = {
  type: 'message.completed' | 'message.failed' | 'message.stopped'
  messageId: string
  content: string
  processingStatus: Extract<MessageProcessingStatus, 'completed' | 'failed' | 'stopped'>
  projectProcessingStatus: ProjectProcessingStatus
  providerResponseId?: string
  error?: StreamError
}

export type MessageHeartbeatEvent = {
  type: 'heartbeat'
  messageId: string
}

export type MessageStreamEvent =
  | MessageStartedEvent
  | MessageDeltaEvent
  | MessageTerminalEvent
  | MessageHeartbeatEvent

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
  devRuntime?: DevRuntime | null
}

export type WorkspaceResult = {
  projects: Project[]
  selectedProjectId?: string
  workspace?: ProjectWorkspace
}

export interface ProjectRepository {
  saveProject(project: Project, userId?: string): Promise<Project>
  getProject(id: string, userId?: string): Promise<Project | undefined>
  listProjects(userId?: string): Promise<Project[]>
  deleteProject(id: string, userId?: string): Promise<boolean>
  updateProjectProcessingState(
    id: string,
    processingStatus: ProjectProcessingStatus,
    userId?: string,
    activeAgentMessageId?: string,
    processingStartedAt?: string
  ): Promise<Project | undefined>
}

export interface ProjectMessageRepository {
  saveMessage(message: Message, userId?: string): Promise<Message>
  updateMessageStatus(id: string, status: Message['status']): Promise<Message | undefined>
  updateMessageProcessingStatus(id: string, status: Message['processingStatus']): Promise<Message | undefined>
  updateMessage(
    id: string,
    updates: Partial<
      Pick<
        Message,
        | 'content'
        | 'processingStatus'
        | 'parentMessageId'
        | 'provider'
        | 'providerResponseId'
        | 'errorMessage'
        | 'startedAt'
        | 'completedAt'
        | 'updatedAt'
      >
    >
  ): Promise<Message | undefined>
  bulkUpdateMessageStatusByProject(projectId: string, status: Message['status'], userId?: string): Promise<number>
  getMessage(projectId: string, messageId: string, userId?: string): Promise<Message | undefined>
  listMessages(projectId: string, userId?: string, cursor?: MessageCursor): Promise<MessagePage>
  saveAgentMessageChunk(chunk: AgentMessageChunk, userId?: string): Promise<AgentMessageChunk>
  listAgentMessageChunks(messageId: string, userId?: string): Promise<AgentMessageChunk[]>
}

export interface ProjectFileNodeRepository {
  saveFileNode(node: ProjectFileNode, userId?: string): Promise<ProjectFileNode>
  getFileNode(projectId: string, nodeId: string, userId?: string): Promise<ProjectFileNode | undefined>
  listFileNodes(projectId: string, userId?: string): Promise<ProjectFileNode[]>
}
