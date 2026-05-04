import { describe, expect, it } from 'vitest'
import { FakeAIProvider } from '../../src/ai/ai-provider'
import { GenerationService } from '../../src/ai/generation-service'
import { unsafeAIOutput } from '../fixtures/ai-output'

describe('generation errors', () => {
  it('blocks unsafe AI content', async () => { const result = await new GenerationService(new FakeAIProvider(unsafeAIOutput)).generate({} as never); expect(result.validation.blockedSafetyFindings.length).toBeGreaterThan(0) })
})
