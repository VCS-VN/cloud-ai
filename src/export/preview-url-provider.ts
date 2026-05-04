import type { OutputProvider } from './output-provider'
import { PreviewService } from '@/projects/preview-service'

export class PreviewUrlProvider implements OutputProvider {
  constructor(private readonly previewService: PreviewService) {}
  async createOutput(projectId: string, revisionId: string) {
    const preview = await this.previewService.createPreview(projectId, revisionId)
    return { method: 'preview-url', url: preview.url, token: preview.token }
  }
}
