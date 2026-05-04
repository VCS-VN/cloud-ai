import type { StorefrontPage, StorefrontSection } from '../storefront/types'

export function addSection(page: StorefrontPage, section: StorefrontSection): StorefrontPage { return { ...page, sections: [...page.sections, section] } }
export function deleteSection(page: StorefrontPage, sectionId: string): StorefrontPage { return { ...page, sections: page.sections.filter((section) => section.id !== sectionId) } }
export function reorderSection(page: StorefrontPage, sectionId: string, toIndex: number): StorefrontPage {
  const sections = page.sections.filter((section) => section.id !== sectionId)
  const section = page.sections.find((item) => item.id === sectionId)
  if (!section) return page
  sections.splice(toIndex, 0, section)
  return { ...page, sections }
}
