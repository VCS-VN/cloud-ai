import { describe, expect, it } from 'vitest'
import { FakeAIProvider } from '../../../src/ai/ai-provider'
import { GenerationService } from '../../../src/ai/generation-service'
import { validAIOutput } from '../../fixtures/storefront-project'

describe('scoped regeneration', () => {
  it('uses same validation pipeline for section regeneration', async () => { const result = await new GenerationService(new FakeAIProvider(validAIOutput)).regenerateSection({ scope: { kind: 'section', pageId: 'home', sectionId: 'hero' } } as never); expect(result.applied).toBe(true) })
})
