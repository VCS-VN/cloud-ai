import type { Message } from './types'
import type { ProjectMessageRepository, StorefrontBuilderProjectRepository } from '../../projects/repositories'

function assertMessageContent(content: string) {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('Message không được để trống.')
  return trimmed
}

export class StorefrontBuilderMessageService {
  constructor(
    private readonly projectRepository: StorefrontBuilderProjectRepository,
    private readonly messageRepository: ProjectMessageRepository
  ) {}

  async getProjectMessages(projectId: string): Promise<Message[]> {
    const project = await this.projectRepository.getBuilderProject(projectId)
    if (!project) throw new Error('Không tìm thấy project.')
    return this.messageRepository.listMessages(projectId)
  }

  async sendProjectMessage(projectId: string, content: string): Promise<Message[]> {
    const project = await this.projectRepository.getBuilderProject(projectId)
    if (!project) throw new Error('Không tìm thấy project.')

    const now = new Date().toISOString()
    const userMessage = await this.messageRepository.saveMessage({
      id: crypto.randomUUID(),
      projectId,
      role: 'user',
      content: assertMessageContent(content),
      status: 'completed',
      createdAt: now
    })

    const agentMessage = await this.messageRepository.saveMessage({
      id: crypto.randomUUID(),
      projectId,
      role: 'agent',
      content: 'Mình đã ghi nhận yêu cầu mới. Ở MVP này, phản hồi agent là placeholder an toàn để mô phỏng luồng hội thoại.',
      status: 'completed',
      createdAt: new Date(Date.parse(now) + 1).toISOString()
    })

    return [userMessage, agentMessage]
  }
}
