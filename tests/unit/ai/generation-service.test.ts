import { describe, expect, it } from 'vitest'
import { FakeAIProvider } from '../../../src/ai/ai-provider'
import { GenerationService } from '../../../src/ai/generation-service'
import { validAIOutput } from '../../fixtures/storefront-project'
import { invalidAIOutput } from '../../fixtures/ai-output'

describe('generation service', () => {
  it('applies valid generated output', async () => { const result = await new GenerationService(new FakeAIProvider(validAIOutput)).generate({} as never); expect(result.applied).toBe(true) })
  it('preserves state on invalid output', async () => { const result = await new GenerationService(new FakeAIProvider(invalidAIOutput)).generate({} as never); expect(result.applied).toBe(false) })
})
