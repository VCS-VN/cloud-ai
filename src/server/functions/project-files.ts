import { createServerFn } from '@tanstack/react-start'
import { getStorefrontBuilderServices } from '../../features/storefront-builder/runtime'

export const getProjectFileTree = createServerFn({ method: 'GET' })
  .inputValidator((data: { projectId: string }) => data)
  .handler(async ({ data }) => {
    const { fileTreeService } = await getStorefrontBuilderServices()
    return fileTreeService.getProjectFileTree(data.projectId)
  })

export const getProjectFileNode = createServerFn({ method: 'GET' })
  .inputValidator((data: { projectId: string; nodeId: string }) => data)
  .handler(async ({ data }) => {
    const { fileTreeService } = await getStorefrontBuilderServices()
    return fileTreeService.getProjectFileNode(data.projectId, data.nodeId)
  })
