import type { StorefrontProject, StorefrontSection } from './types'

export function mergeRegeneratedProject(current: StorefrontProject, next: StorefrontProject, overwrite = false): StorefrontProject {
  if (overwrite) return next
  const currentSections = new Map(current.pages.flatMap((page) => page.sections.map((section) => [section.id, section] as const)))
  return {
    ...next,
    pages: next.pages.map((page) => ({ ...page, sections: page.sections.map((section) => mergeSection(currentSections.get(section.id), section)) }))
  }
}

function mergeSection(current: StorefrontSection | undefined, next: StorefrontSection): StorefrontSection {
  if (!current) return next
  const editedPaths = current.editableFields.map((field) => field.path).filter((path) => current.updatedBy === 'user' || current.source === 'mixed')
  if (!editedPaths.length) return next
  return { ...next, content: { ...next.content, ...pickContent(current.content, editedPaths) }, source: 'mixed', updatedBy: 'mixed' }
}

function pickContent(content: Record<string, unknown>, paths: string[]): Record<string, unknown> {
  return Object.fromEntries(paths.map((path) => [path.replace(/^content\./, ''), content[path.replace(/^content\./, '')]]).filter(([, value]) => value !== undefined))
}
