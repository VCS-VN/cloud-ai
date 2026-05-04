import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StorefrontRenderer } from '../../src/rendering/StorefrontRenderer'
import { validProject } from '../fixtures/storefront-project'

describe('e2e create generate preview', () => {
  it('renders draft preview for happy path data', () => { const html = renderToStaticMarkup(<StorefrontRenderer project={validProject} draft />); expect(html).toContain('Draft preview'); expect(html).toContain('Lime Mug') })
})
