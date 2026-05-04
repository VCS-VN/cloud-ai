import type { StorefrontSection } from '../storefront/types'
export function FallbackSection({ section }: { section: StorefrontSection }) {
  return <section data-section-id={section.id} data-section-type={section.type}><h2>{section.title}</h2><pre>{JSON.stringify(section.content, null, 2)}</pre></section>
}
