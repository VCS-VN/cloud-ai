import { describe, expect, it } from 'vitest'
import { OperatorService } from '../../src/projects/operator-service'
import { InMemoryProjectRepository } from '../../src/projects/repositories'
import { validProject } from '../fixtures/storefront-project'

describe('operator state', () => {
  it('returns redacted state', async () => { const repo = new InMemoryProjectRepository(); await repo.saveProject({ ...validProject, businessProfile: { ...validProject.businessProfile, sourcePrompt: 'AI_API_KEY=secret' } }); const state = await new OperatorService(repo).getProjectState(validProject.id); expect(JSON.stringify(state)).not.toContain('AI_API_KEY=secret') })
})
