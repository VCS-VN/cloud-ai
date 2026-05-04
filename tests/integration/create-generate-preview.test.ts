import { describe, expect, it } from 'vitest'
import { FakeAIProvider } from '../../src/ai/ai-provider'
import { GenerationService } from '../../src/ai/generation-service'
import { ProjectService } from '../../src/projects/project-service'
import { InMemoryProjectRepository } from '../../src/projects/repositories'
import { validAIOutput } from '../fixtures/storefront-project'

describe('create generate preview flow', () => {
  it('creates a persisted project from fake generation', async () => { const repo = new InMemoryProjectRepository(); const project = await new ProjectService(repo, new GenerationService(new FakeAIProvider(validAIOutput))).createFromPrompt({ projectId: 'p1' } as never); expect(project.pages[0].sections[0].id).toBe('hero'); expect(await repo.getProject('p1')).toBeTruthy() })
})
