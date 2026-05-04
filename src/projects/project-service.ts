import { GenerationService, createProjectFromOutput } from '../ai/generation-service'
import type { GenerationRequest } from '../ai/ai-provider'
import type { StorefrontProject } from '../storefront/types'
import type { ProjectRepository } from './repositories'

export class ProjectService {
  constructor(private readonly repository: ProjectRepository, private readonly generationService: GenerationService) {}
  async createFromPrompt(request: GenerationRequest): Promise<StorefrontProject> {
    const result = await this.generationService.generate(request)
    if (!result.applied || !result.output) throw new Error(result.record.errors.join(', ') || 'Generation failed')
    const project = createProjectFromOutput(request.projectId ?? crypto.randomUUID(), result.output)
    const revisionId = crypto.randomUUID()
    project.currentRevisionId = revisionId
    await this.repository.saveProject(project)
    await this.repository.saveRevision({ id: revisionId, projectId: project.id, project, createdAt: new Date().toISOString() })
    return project
  }
  async save(project: StorefrontProject): Promise<StorefrontProject> {
    const revisionId = crypto.randomUUID()
    const updated = { ...project, currentRevisionId: revisionId, updatedAt: new Date().toISOString() }
    await this.repository.saveProject(updated)
    await this.repository.saveRevision({ id: revisionId, projectId: project.id, project: updated, createdAt: updated.updatedAt })
    return updated
  }
  load(id: string) { return this.repository.getProject(id) }
}
