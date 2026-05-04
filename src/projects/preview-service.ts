import type { PreviewTokenRepository, ProjectRepository } from './repositories'

export class PreviewService {
  constructor(private readonly projects: ProjectRepository, private readonly tokens: PreviewTokenRepository, private readonly basePath = '/preview') {}
  async createPreview(projectId: string, revisionId: string) {
    const token = crypto.randomUUID()
    await this.tokens.savePreviewToken({ token, projectId, revisionId, createdAt: new Date().toISOString() })
    return { token, url: `${this.basePath}/${token}` }
  }
  async resolvePreview(token: string) {
    const record = await this.tokens.getPreviewToken(token)
    if (!record) return undefined
    return this.projects.getRevision(record.revisionId)
  }
}
