import { describe, expect, it } from 'vitest'
import { PreviewUrlProvider } from '../../../src/export/preview-url-provider'
import { InMemoryProjectRepository } from '../../../src/projects/repositories'
import { PreviewService } from '../../../src/projects/preview-service'

describe('preview url provider', () => {
  it('creates preview URL output', async () => { const repo = new InMemoryProjectRepository(); const result = await new PreviewUrlProvider(new PreviewService(repo, repo)).createOutput('p', 'r'); expect(result.method).toBe('preview-url'); expect(result.url).toContain('/preview/') })
})
