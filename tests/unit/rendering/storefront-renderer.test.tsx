import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StorefrontRenderer } from '../../../src/rendering/StorefrontRenderer'
import { validProject } from '../../fixtures/storefront-project'

describe('StorefrontRenderer', () => {
  it('renders valid project data with draft indicator', () => { const html = renderToStaticMarkup(<StorefrontRenderer project={validProject} draft />); expect(html).toContain('Draft preview'); expect(html).toContain('Modern Ceramics') })
  it('renders unknown custom sections through fallback', () => { const project = { ...validProject, pages: [{ ...validProject.pages[0], sections: [{ ...validProject.pages[0].sections[0], type: 'custom-story' }] }] }; expect(renderToStaticMarkup(<StorefrontRenderer project={project} />)).toContain('custom-story') })
})
