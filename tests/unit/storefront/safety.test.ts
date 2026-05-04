import { describe, expect, it } from 'vitest'
import { findContentSafetyIssues } from '../../../src/storefront/safety'

describe('content safety', () => {
  it('blocks unsupported commercial claims', () => expect(findContentSafetyIssues({ text: 'doctor approved guaranteed cure' }).length).toBeGreaterThan(0))
})
