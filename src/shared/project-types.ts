import type { DevRuntime } from "@/features/projects/legacy/project-state.schema";
import type { DevRuntimeEvent } from "@/features/runtime/legacy/runtime-events";

export type RecordStatus = 0 | 1
export type ProjectStatus = 0 | 'draft' | 'generating' | 'ready' | 'failed'
export type MessageRole = 'user' | 'agent'
export type MessageStatus = 0 | 'pending' | 'completed' | 'failed'
export type ProjectProcessingStatus = 'idle' | 'processing'
export type MessageProcessingStatus = 'pending' | 'streaming' | 'completed' | 'failed' | 'stopped'
export type AgentMessageKind = 'plan' | 'answer' | 'clarification' | 'error' | 'review_required' | 'agent_question' | 'thinking' | 'reasoning' | 'agent_message'
export type AgentRunStatus = 'streaming' | 'awaiting_input' | 'completed' | 'failed' | 'stopped' | 'interrupted'
export type BuilderRunKind = 'init' | 'update' | 'new_route' | 'generate_page' | 'redesign'
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
  | 'RUN_NOT_AWAITING_INPUT'
  | 'INVALID_OPTION'
  | 'OPTION_ALREADY_SELECTED'
  | 'RETRY_NOT_ALLOWED'
  | 'STOP_NOT_ALLOWED'

export type DesignVariant = {
  id: string
  label: string
  description: string
  preview: {
    font: string
    palette: string[]
    motion: number
    density?: number
  }
}

export type ProgressTimelineEvent =
  | { at: number; kind: 'milestone'; milestone: string }
  | { at: number; kind: 'section'; section: string; locale: 'vi' | 'en' }
  | { at: number; kind: 'summary'; text: string }
  | { at: number; kind: 'error'; failureCode: string }

export type PlanPhase =
  | { stage: 'plan_pending' }
  | {
      stage: 'plan_ready'
      planMarkdown: string
      planTurnDoneAt: number
      planThreadId: string
    }
  | {
      stage: 'plan_rejected'
      planMarkdown: string
      rejectedAt: number
    }
  | {
      stage: 'executing'
      planMarkdown: string
      executeThreadId: string
      approvedAt: number
    }

export type ClarificationSnapshot =
  | {
      questionType: 'design_variant'
      options: DesignVariant[]
      selectedOptionId: string | null
      customAnswerAllowed: true
      originalRunPrompt: string
    }
  | {
      questionType: 'skill_clarification'
      options: { id: string; label: string }[]
      selectedOptionId: string | null
      customAnswerAllowed: boolean
      originalRunPrompt: string
    }
  | {
      questionType: 'plan_review'
      planMarkdown: string
      selectedAction: 'approve' | 'reject' | null
      originalRunPrompt: string
    }

export type ClarificationOption = {
  id: string
  label: string
  description: string
  pros: string[]
  cons: string[]
  recommended: boolean
}

export type DesignQuestionMetadata = {
  options: DesignVariant[]
  selectedOptionId: string | null
  questionType?: 'design_variant' | 'optional_pages'
}

export type ClarificationQuestionMetadata = {
  questionType: 'clarification_options'
  options: ClarificationOption[]
  selectedOptionId: string | null
  customAnswerAllowed?: boolean
  source?: 'thinking' | 'execution_fallback'
}

export type AgentQuestionMetadata = DesignQuestionMetadata | ClarificationQuestionMetadata

export type OrchestratorState =
  | 'idle'
  | 'analyzing'
  | 'planning'
  | 'awaiting_input'
  | 'executing'
  | 'validating'
  | 'responding'
  | 'completed'
  | 'failed'
  | 'stopped'

export type TokenContext = {
  used: number
  total: number
  percent: number
  compactedRuns: number
}

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

export type PreviewRunningStatus = 'running' | 'starting' | 'error' | 'stopped'

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
  /**
   * Preview status derived from the live PM2 process (source of truth).
   * Populated by ProjectService.listProjects when the runtime orchestrator
   * is available. Absent on records that were never previewed.
   */
  previewStatus?: PreviewRunningStatus
  /**
   * Slugs of pages the AI has authored (home + product-detail seeded at init,
   * others appended by /generate-page runs). Drives the /generate-page menu
   * status badges. Absent on records loaded without project-state join.
   */
  generatedPages?: Array<{ slug: string; generatedAt: string }>
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
  metadata?: AgentQuestionMetadata | null
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

export type TodoItem = { id: string; text: string; completed: boolean }

export type RunUIState = {
  runId: string
  status: AgentRunStatus
  skeleton: SkeletonState | null
  todoItems: TodoItem[] | null
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
  metadata?: AgentQuestionMetadata | null
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

export type RunAwaitingInputEvent = {
  type: 'run.awaiting_input'
  runId: string
}

export type OptionSelectedEvent = {
  type: 'option.selected'
  runId: string
  messageId: string
  optionId: string
  userMessage?: Message
}

export type PlanTodoUpdatedEvent = {
  type: 'plan.todo_updated'
  runId: string
  items: TodoItem[]
  at: number
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
  | RunAwaitingInputEvent
  | OptionSelectedEvent
  | PlanTodoUpdatedEvent

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
        | 'metadata'
      >
    >
  ): Promise<Message | undefined>
  bulkUpdateMessageStatusByProject(projectId: string, status: Message['status'], userId?: string): Promise<number>
  markAgentQuestionAnswered(projectId: string, runId: string, selectedOptionId: string, userId?: string): Promise<Message | undefined>
  getMessage(projectId: string, messageId: string, userId?: string): Promise<Message | undefined>
  listMessages(projectId: string, userId?: string, cursor?: MessageCursor): Promise<MessagePage>
  listMessagesByRunId(runId: string, userId?: string): Promise<Message[]>
}

export interface ProjectFileNodeRepository {
  saveFileNode(node: ProjectFileNode, userId?: string): Promise<ProjectFileNode>
  getFileNode(projectId: string, nodeId: string, userId?: string): Promise<ProjectFileNode | undefined>
  listFileNodes(projectId: string, userId?: string): Promise<ProjectFileNode[]>
}
