import { describe, expect, it } from 'vitest'
import { parseStructuredOutput } from '../../../src/ai/output-parser'

describe('output parser', () => {
  it('parses JSON strings', () => expect(parseStructuredOutput('{"ok":true}')).toEqual({ ok: true }))
  it('throws on invalid JSON strings', () => expect(() => parseStructuredOutput('{bad')).toThrow())
})
