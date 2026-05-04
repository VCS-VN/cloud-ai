import type { StorefrontProject, Product, ThemeConfig } from '@/storefront/types'

export type EditOperation =
  | { kind: 'update-section-content'; sectionId: string; field: string; value: unknown }
  | { kind: 'update-product'; productId: string; patch: Partial<Product> }
  | { kind: 'update-theme'; patch: Partial<ThemeConfig> }

export function applyEdit(project: StorefrontProject, operation: EditOperation): StorefrontProject {
  if (operation.kind === 'update-product') return { ...project, products: project.products.map((product) => product.id === operation.productId ? { ...product, ...operation.patch, editedFields: [...new Set([...product.editedFields, ...Object.keys(operation.patch)])], source: 'mixed' } : product) }
  if (operation.kind === 'update-theme') return { ...project, theme: { ...project.theme, ...operation.patch } }
  return { ...project, pages: project.pages.map((page) => ({ ...page, sections: page.sections.map((section) => section.id === operation.sectionId ? { ...section, content: { ...section.content, [operation.field]: operation.value }, source: 'mixed', updatedBy: 'user' } : section) })) }
}
