import { describe, expect, it } from 'vitest'
import { redactSecrets } from '../../../src/security/redaction'

describe('redaction', () => {
  it('redacts secret-like keys deeply', () => expect(redactSecrets({ AI_API_KEY: 'secret', nested: { token: 'abc', ok: true } })).toEqual({ AI_API_KEY: '[REDACTED]', nested: { token: '[REDACTED]', ok: true } }))
})
