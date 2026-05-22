import { createServerFn } from '@tanstack/react-start'
import { requireServerUser } from './auth'
async function loadProjectServices() {
  return (await import('../services/project-services')).getProjectServices()
}


export const getProjectFileTree = createServerFn({ method: 'GET' })
  .inputValidator((data: { projectId: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireServerUser()
    const { fileTreeService } = await loadProjectServices()
    return fileTreeService.getProjectFileTree(data.projectId, user.id)
  })

export const getProjectFileNode = createServerFn({ method: 'GET' })
  .inputValidator((data: { projectId: string; nodeId: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireServerUser()
    const { fileTreeService } = await loadProjectServices()
    return fileTreeService.getProjectFileNode(data.projectId, data.nodeId, user.id)
  })
