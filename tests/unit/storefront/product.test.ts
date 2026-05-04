import { describe, expect, it } from 'vitest'
import { normalizeProduct } from '../../../src/storefront/defaults'

describe('product defaults', () => {
  it('fills safe placeholders and marks missing fields', () => { const product = normalizeProduct({ id: 'p1' }); expect(product.placeholderImage).toBeTruthy(); expect(product.missingFields).toContain('price') })
})
