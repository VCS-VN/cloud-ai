import { createServerFn } from '@tanstack/react-start'
import { requireServerUser } from './auth'
import { getStorefrontBuilderServices } from '../services/storefront-builder-services'

export const listProjectMessages = createServerFn({ method: 'GET' })
  .inputValidator((data: { projectId: string; beforeCreatedAt?: string; beforeId?: string; limit?: number }) => data)
  .handler(async ({ data }) => {
    const user = await requireServerUser()
    const { messageService } = await getStorefrontBuilderServices()
    return messageService.getProjectMessages(data.projectId, user.id, {
      beforeCreatedAt: data.beforeCreatedAt,
      beforeId: data.beforeId,
      limit: data.limit
    })
  })

export const sendProjectMessage = createServerFn({ method: 'POST' })
  .inputValidator((data: { projectId: string; content: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireServerUser()
    const { messageService } = await getStorefrontBuilderServices()
    return messageService.sendProjectMessage(data.projectId, data.content, user.id)
  })

export const retryProjectMessage = createServerFn({ method: 'POST' })
  .inputValidator((data: { projectId: string; messageId: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireServerUser()
    const { messageService } = await getStorefrontBuilderServices()
    return messageService.retryProjectMessage(data.projectId, data.messageId, user.id)
  })
