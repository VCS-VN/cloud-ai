import type { StorefrontProject } from '../storefront/types'
import { resolveSectionComponent } from './section-registry'

export function StorefrontRenderer({ project, draft = false }: { project: StorefrontProject; draft?: boolean }) {
  const page = project.pages[0]
  return <main style={themeStyle(project.theme.colors)}>{draft ? <div role="status">Draft preview</div> : null}<h1>{project.siteTitle}</h1>{page.sections.map((section) => { const Section = resolveSectionComponent(section.type); return <Section key={section.id} section={section} products={project.products} /> })}</main>
}
function themeStyle(colors: Record<string, string>) { return Object.fromEntries(Object.entries(colors).map(([key, value]) => [`--theme-${key}`, value])) as React.CSSProperties }
