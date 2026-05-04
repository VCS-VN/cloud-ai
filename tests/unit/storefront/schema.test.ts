import { describe, expect, it } from 'vitest'
import { storefrontProjectSchema } from '../../../src/storefront/schema'
import { validateAIOutput } from '../../../src/storefront/validation'
import { validAIOutput, validProject } from '../../fixtures/storefront-project'
import { invalidAIOutput } from '../../fixtures/ai-output'

describe('storefront schema', () => {
  it('validates a complete storefront project', () => expect(storefrontProjectSchema.safeParse(validProject).success).toBe(true))
  it('accepts valid AI output through validation', () => expect(validateAIOutput(validAIOutput).valid).toBe(true))
  it('rejects invalid AI output safely', () => expect(validateAIOutput(invalidAIOutput).valid).toBe(false))
})
