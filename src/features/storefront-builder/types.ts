export type ProjectStatus = 'draft' | 'generating' | 'ready' | 'failed'
export type MessageRole = 'user' | 'agent'
export type MessageStatus = 'pending' | 'completed' | 'failed'
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
  createdAt: string
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
