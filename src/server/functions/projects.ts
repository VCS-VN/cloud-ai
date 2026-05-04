import { createServerFn } from '@tanstack/react-start'
import { requireServerUser } from './auth'
import { getStorefrontBuilderServices } from '../../features/storefront-builder/runtime'

export const listProjects = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireServerUser()
  const { projectService } = await getStorefrontBuilderServices()
  return projectService.listProjects(user.id)
})

export const getProjectWorkspace = createServerFn({ method: 'GET' })
  .inputValidator((data: { projectId?: string } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    const user = await requireServerUser()
    const { projectService } = await getStorefrontBuilderServices()
    return projectService.getWorkspace(data.projectId, user.id)
  })

export const createProjectFromPrompt = createServerFn({ method: 'POST' })
  .inputValidator((data: { prompt: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireServerUser()
    const { projectService } = await getStorefrontBuilderServices()
    return projectService.createProjectFromPrompt(data.prompt, user.id)
  })
