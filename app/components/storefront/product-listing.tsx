import type { Product, StorefrontSection } from '../../../src/storefront/types'
export function ProductListing({ section, products = [] }: { section: StorefrontSection; products?: Product[] }) {
  return <section className="px-8 py-16 bg-[#dceeb1]"><h2>{section.title}</h2><div>{products.map((product) => <article key={product.id}><h3>{product.name}</h3><p>{product.description}</p><strong>{product.price}</strong><button>{product.ctaLabel}</button></article>)}</div></section>
}
