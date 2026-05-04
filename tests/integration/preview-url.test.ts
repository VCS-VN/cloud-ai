import { describe, expect, it } from 'vitest'
import { PreviewService } from '../../src/projects/preview-service'
import { InMemoryProjectRepository } from '../../src/projects/repositories'
import { validProject } from '../fixtures/storefront-project'

describe('preview url', () => {
  it('resolves token to project revision', async () => { const repo = new InMemoryProjectRepository(); await repo.saveRevision({ id: 'rev', projectId: 'p', project: validProject, createdAt: 'now' }); const service = new PreviewService(repo, repo); const preview = await service.createPreview('p', 'rev'); expect((await service.resolvePreview(preview.token))?.project.id).toBe(validProject.id) })
})
