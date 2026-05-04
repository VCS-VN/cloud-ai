import { createServerFn } from '@tanstack/react-start'
import { getStorefrontBuilderServices } from '../../features/storefront-builder/runtime'

export const listProjects = createServerFn({ method: 'GET' }).handler(async () => {
  const { projectService } = await getStorefrontBuilderServices()
  return projectService.listProjects()
})

export const getProjectWorkspace = createServerFn({ method: 'GET' })
  .inputValidator((data: { projectId?: string } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    const { projectService } = await getStorefrontBuilderServices()
    return projectService.getWorkspace(data.projectId)
  })

export const createProjectFromPrompt = createServerFn({ method: 'POST' })
  .inputValidator((data: { prompt: string }) => data)
  .handler(async ({ data }) => {
    const { projectService } = await getStorefrontBuilderServices()
    return projectService.createProjectFromPrompt(data.prompt)
  })
