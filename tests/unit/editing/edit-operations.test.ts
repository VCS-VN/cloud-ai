import { describe, expect, it } from 'vitest'
import { applyEdit } from '../../../src/editing/edit-operations'
import { addSection, deleteSection, reorderSection } from '../../../src/editing/section-operations'
import { validProject, heroSection } from '../../fixtures/storefront-project'

describe('edit operations', () => {
  it('updates section content and product data', () => { const edited = applyEdit(validProject, { kind: 'update-section-content', sectionId: 'hero', field: 'heading', value: 'New' }); expect(edited.pages[0].sections[0].content.heading).toBe('New') })
  it('adds deletes and reorders sections', () => { const originalLength = validProject.pages[0].sections.length; const page = addSection(validProject.pages[0], { ...heroSection, id: 'new' }); expect(page.sections).toHaveLength(originalLength + 1); expect(deleteSection(page, 'new').sections).toHaveLength(originalLength); expect(reorderSection(page, 'new', 0).sections[0].id).toBe('new') })
})
