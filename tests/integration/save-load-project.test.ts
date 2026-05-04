import { describe, expect, it } from 'vitest'
import { FakeAIProvider } from '../../src/ai/ai-provider'
import { GenerationService } from '../../src/ai/generation-service'
import { applyEdit } from '../../src/editing/edit-operations'
import { ProjectService } from '../../src/projects/project-service'
import { InMemoryProjectRepository } from '../../src/projects/repositories'
import { validAIOutput } from '../fixtures/storefront-project'

describe('save load project', () => {
  it('persists edited revisions', async () => { const repo = new InMemoryProjectRepository(); const service = new ProjectService(repo, new GenerationService(new FakeAIProvider(validAIOutput))); const project = await service.createFromPrompt({ projectId: 'p2' } as never); const saved = await service.save(applyEdit(project, { kind: 'update-section-content', sectionId: 'hero', field: 'heading', value: 'Saved' })); expect((await service.load('p2'))?.currentRevisionId).toBe(saved.currentRevisionId) })
})
