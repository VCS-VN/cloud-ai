import type { StorefrontSection } from '../../../src/storefront/types'
export function FooterSection({ section }: { section: StorefrontSection }) { return <footer><p>{String(section.content.text ?? section.title)}</p></footer> }
