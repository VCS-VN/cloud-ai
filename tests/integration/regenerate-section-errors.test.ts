import { describe, expect, it } from 'vitest'
import { FakeAIProvider } from '../../src/ai/ai-provider'
import { GenerationService } from '../../src/ai/generation-service'
import { invalidAIOutput } from '../fixtures/ai-output'

describe('regeneration errors', () => {
  it('rejects invalid scoped regeneration output', async () => { const result = await new GenerationService(new FakeAIProvider(invalidAIOutput)).regenerateSection({} as never); expect(result.applied).toBe(false) })
})
