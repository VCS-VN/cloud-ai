import type { DevRuntime } from "@/features/ai-agent/project/project-state.schema";
import type { DevRuntimeEvent } from "@/features/ai-agent/runtime/runtime-events";

export type RecordStatus = 0 | 1
export type ProjectStatus = 0 | 'draft' | 'generating' | 'ready' | 'failed'
export type MessageRole = 'user' | 'agent'
export type MessageStatus = 0 | 'pending' | 'completed' | 'failed'
export type ProjectProcessingStatus = 'idle' | 'processing'
export type MessageProcessingStatus = 'pending' | 'streaming' | 'completed' | 'failed' | 'stopped'
export type AgentMessageKind = 'plan' | 'answer' | 'clarification' | 'error' | 'review_required'
export type AgentRunStatus = 'streaming' | 'completed' | 'failed' | 'stopped'
export type SkeletonPhase =
  | 'starting'
  | 'understanding'
  | 'planning'
  | 'editing'
  | 'installing'
  | 'starting_preview'
  | 'validating'
  | 'repairing'
  | 'responding'
export type ProjectFileNodeType = 'file' | 'folder'
export type PwaDisplayMode = 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser'
export type PwaIconPurpose = 'any' | 'maskable' | 'monochrome'
export type StreamErrorCode =
  | 'UNAUTHENTICATED'
  | 'PROJECT_NOT_FOUND'
  | 'PROMPT_EMPTY'
  | 'PROJECT_ALREADY_PROCESSING'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_STREAM_FAILED'
  | 'MESSAGE_NOT_FOUND'
  | 'RUN_NOT_FOUND'
  | 'RUN_INTERRUPTED'
  | 'RETRY_NOT_ALLOWED'
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
  activeRunId?: string
  processingStartedAt?: string
  updatedAt: string
  createdAt: string
  selectedStoreSlug?: string | null
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
  runId?: string
  kind?: AgentMessageKind
  provider?: string
  providerResponseId?: string
  errorMessage?: string
  startedAt?: string
  completedAt?: string
  updatedAt?: string
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

export type RunCreatedState = {
  runId: string
  userMessage: Message
  project: Pick<Project, 'id' | 'processingStatus' | 'activeRunId'>
  stream: {
    url: string
  }
}

export type SkeletonState = {
  phase: SkeletonPhase
  label: string
  detail?: string
}

export type RunUIState = {
  runId: string
  status: AgentRunStatus
  skeleton: SkeletonState | null
  error?: StreamError
}

export type RunStartedEvent = {
  type: 'run.started'
  runId: string
  projectId: string
}

export type RunMessageCreatedEvent = {
  type: 'message.created'
  runId: string
  messageId: string
  kind: AgentMessageKind
  content: string
  processingStatus: MessageProcessingStatus
  createdAt: string
}

export type RunMessageDeltaEvent = {
  type: 'message.delta'
  runId: string
  messageId: string
  delta: string
}

export type RunMessageCompletedEvent = {
  type: 'message.completed'
  runId: string
  messageId: string
  content: string
}

export type SkeletonUpdateEvent = {
  type: 'skeleton.update'
  runId: string
  phase: Exclude<SkeletonPhase, 'starting'>
  label: string
  detail?: string
}

export type RunTerminalEvent = {
  type: 'run.completed' | 'run.stopped'
  runId: string
  projectProcessingStatus: Extract<ProjectProcessingStatus, 'idle'>
}

export type RunFailedEvent = {
  type: 'run.failed'
  runId: string
  projectProcessingStatus: Extract<ProjectProcessingStatus, 'idle'>
  error: StreamError
}

export type RunHeartbeatEvent = {
  type: 'heartbeat'
  runId: string
}

export type RunStreamEvent =
  | RunStartedEvent
  | RunMessageCreatedEvent
  | RunMessageDeltaEvent
  | RunMessageCompletedEvent
  | SkeletonUpdateEvent
  | RunTerminalEvent
  | RunFailedEvent
  | RunHeartbeatEvent

export type RuntimeStreamEvent =
  | DevRuntimeEvent
  | { type: 'heartbeat' }

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



export type StoreOption = {
  slug: string
  displayName: string
}

export type StoreListResult = {
  stores: StoreOption[]
  page: number
  limit: number
  total?: number
  hasMore?: boolean
}

export type ProjectSettingsInput = {
  name?: string
  selectedStoreSlug?: string | null
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
  updateProjectSettings(id: string, settings: ProjectSettingsInput, userId?: string): Promise<Project | undefined>
  updateProjectProcessingState(
    id: string,
    processingStatus: ProjectProcessingStatus,
    userId?: string,
    activeRunId?: string,
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
        | 'runId'
        | 'kind'
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
  listMessagesByRunId(runId: string, userId?: string): Promise<Message[]>
}

export interface ProjectFileNodeRepository {
  saveFileNode(node: ProjectFileNode, userId?: string): Promise<ProjectFileNode>
  getFileNode(projectId: string, nodeId: string, userId?: string): Promise<ProjectFileNode | undefined>
  listFileNodes(projectId: string, userId?: string): Promise<ProjectFileNode[]>
}
