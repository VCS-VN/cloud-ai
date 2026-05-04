import { describe, expect, it } from 'vitest'
import { mergeRegeneratedProject } from '../../../src/storefront/merge-user-edits'
import { validProject } from '../../fixtures/storefront-project'

describe('merge user edits', () => {
  it('preserves edited section content unless overwrite is explicit', () => {
    const current = { ...validProject, pages: [{ ...validProject.pages[0], sections: [{ ...validProject.pages[0].sections[0], content: { heading: 'User heading' }, source: 'mixed' as const, updatedBy: 'user' as const }, validProject.pages[0].sections[1]] }] }
    const next = { ...validProject, pages: [{ ...validProject.pages[0], sections: [{ ...validProject.pages[0].sections[0], content: { heading: 'AI heading' } }, validProject.pages[0].sections[1]] }] }
    expect(mergeRegeneratedProject(current, next).pages[0].sections[0].content.heading).toBe('User heading')
    expect(mergeRegeneratedProject(current, next, true).pages[0].sections[0].content.heading).toBe('AI heading')
  })
})
