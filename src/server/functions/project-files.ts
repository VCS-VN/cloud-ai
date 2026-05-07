import { createServerFn } from '@tanstack/react-start'
import { requireServerUser } from './auth'
import { getProjectServices } from '../services/project-services'

export const getProjectFileTree = createServerFn({ method: 'GET' })
  .inputValidator((data: { projectId: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireServerUser()
    const { fileTreeService } = await getProjectServices()
    return fileTreeService.getProjectFileTree(data.projectId, user.id)
  })

export const getProjectFileNode = createServerFn({ method: 'GET' })
  .inputValidator((data: { projectId: string; nodeId: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireServerUser()
    const { fileTreeService } = await getProjectServices()
    return fileTreeService.getProjectFileNode(data.projectId, data.nodeId, user.id)
  })
