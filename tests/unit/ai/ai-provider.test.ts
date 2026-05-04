import { describe, expect, it } from 'vitest'
import { FakeAIProvider } from '../../../src/ai/ai-provider'
import { validAIOutput } from '../../fixtures/storefront-project'

describe('AI provider interface', () => {
  it('allows deterministic fake providers', async () => { const result = await new FakeAIProvider(validAIOutput).generateStorefront(); expect(result.structuredOutput).toEqual(validAIOutput) })
})
