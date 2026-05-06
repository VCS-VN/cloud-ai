import type { Message, MessageCursor, MessagePage } from '@/shared/storefront-builder-types'
import type { ProjectMessageRepository, StorefrontBuilderProjectRepository } from '@/shared/storefront-builder-types'

function assertMessageContent(content: string) {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('Message cannot be empty.')
  return trimmed
}

export class StorefrontBuilderMessageService {
  constructor(
    private readonly projectRepository: StorefrontBuilderProjectRepository,
    private readonly messageRepository: ProjectMessageRepository
  ) {}

  async getProjectMessages(projectId: string, userId?: string, cursor?: MessageCursor): Promise<MessagePage> {
    const project = await this.projectRepository.getBuilderProject(projectId, userId)
    if (!project) throw new Error('Project not found.')
    return this.messageRepository.listMessages(projectId, userId, normalizeCursor(cursor))
  }

  async sendProjectMessage(projectId: string, content: string, userId?: string): Promise<Message[]> {
    const project = await this.projectRepository.getBuilderProject(projectId, userId)
    if (!project) throw new Error('Project not found.')

    const now = new Date().toISOString()
    const userMessage = await this.messageRepository.saveMessage({
      id: crypto.randomUUID(),
      userId,
      projectId,
      role: 'user',
      content: assertMessageContent(content),
      status: 'completed',
      processingStatus: 'completed',
      createdAt: now
    }, userId)

    const agentMessage = await this.messageRepository.saveMessage({
      id: crypto.randomUUID(),
      userId,
      projectId,
      role: 'agent',
      content: 'I have recorded your new request. In this MVP, the agent response is a safe placeholder that simulates the conversation flow.',
      status: 'completed',
      processingStatus: 'completed',
      createdAt: new Date(Date.parse(now) + 1).toISOString()
    }, userId)

    return [userMessage, agentMessage]
  }

  async retryProjectMessage(projectId: string, messageId: string, userId?: string): Promise<Message> {
    const project = await this.projectRepository.getBuilderProject(projectId, userId)
    if (!project) throw new Error('Project not found.')
    const page = await this.messageRepository.listMessages(projectId, userId, { limit: 100 })
    const message = page.messages.find((item) => item.id === messageId)
    if (!message) throw new Error('Message not found.')
    if (message.processingStatus !== 'failed') throw new Error('Only failed messages can be retried.')
    const updated = await this.messageRepository.updateMessageProcessingStatus(messageId, 'completed')
    if (!updated) throw new Error('Message not found.')
    return { ...updated, content: updated.content || 'Retry completed with safe placeholder response.' }
  }
}

function normalizeCursor(cursor?: MessageCursor): MessageCursor {
  const limit = Math.min(Math.max(cursor?.limit ?? 50, 1), 100)
  if (cursor?.beforeCreatedAt && Number.isNaN(new Date(cursor.beforeCreatedAt).getTime())) {
    throw new Error('Invalid cursor.')
  }
  return { beforeCreatedAt: cursor?.beforeCreatedAt, beforeId: cursor?.beforeId, limit }
}
