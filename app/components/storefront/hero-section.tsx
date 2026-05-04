import type { StorefrontSection } from '../../../src/storefront/types'
export function HeroSection({ section }: { section: StorefrontSection }) {
  return <section className="px-8 py-24 bg-white text-black"><p className="font-mono uppercase tracking-wide">{String(section.content.eyebrow ?? '')}</p><h1 className="text-6xl">{String(section.content.heading ?? section.title)}</h1><p>{String(section.content.body ?? '')}</p></section>
}
