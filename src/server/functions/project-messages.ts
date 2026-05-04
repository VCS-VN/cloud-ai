import { createServerFn } from '@tanstack/react-start'
import { requireServerUser } from './auth'
import { getStorefrontBuilderServices } from '../../features/storefront-builder/runtime'

export const listProjectMessages = createServerFn({ method: 'GET' })
  .inputValidator((data: { projectId: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireServerUser()
    const { messageService } = await getStorefrontBuilderServices()
    return messageService.getProjectMessages(data.projectId, user.id)
  })

export const sendProjectMessage = createServerFn({ method: 'POST' })
  .inputValidator((data: { projectId: string; content: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireServerUser()
    const { messageService } = await getStorefrontBuilderServices()
    return messageService.sendProjectMessage(data.projectId, data.content, user.id)
  })
