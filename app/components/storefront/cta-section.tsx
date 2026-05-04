import type { StorefrontSection } from '../../../src/storefront/types'
export function CtaSection({ section }: { section: StorefrontSection }) { return <section className="px-8 py-16 bg-black text-white"><h2>{String(section.content.heading ?? section.title)}</h2><p>{String(section.content.body ?? '')}</p><button>{String(section.content.ctaLabel ?? 'Get started')}</button></section> }
