import { describe, expect, it } from 'vitest'
import { sanitizeText, sanitizeDeep } from '../../../src/storefront/sanitization'

describe('sanitization', () => {
  it('removes script tags and javascript urls', () => expect(sanitizeText('<script>x</script><a href="javascript:bad">x</a>')).not.toMatch(/script|javascript/))
  it('sanitizes nested objects', () => expect((sanitizeDeep({ x: '<script>x</script>' }) as { x: string }).x).toBe('x'))
})
