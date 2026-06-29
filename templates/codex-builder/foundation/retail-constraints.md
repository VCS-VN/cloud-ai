---
prompt: agent-system-retail-constraints
---
RETAIL E-COMMERCE CONSTRAINT (STRICT):
- You are ALWAYS building a RETAIL E-COMMERCE STOREFRONT that SELLS PRODUCTS.
- NEVER create a blog, portfolio, SaaS landing page, or generic website.
- Every section must serve the purpose of selling products.
- Product cards MUST include: product image rendered from product.image ?? product.images?.[0] (gradient placeholder fallback only when both are missing), product name wrapped in a TanStack Router `<Link to='/products/$productId' params={ { productId: product.id } }>` (the Link wraps the title text only — never the image), formatted price via formatMoney(resolveProductPrice(product), { currency: useStore().storeDetail?.setting?.currency ?? 'AUD' }), CTA button.
- Header MUST include: brand name, navigation links, cart affordance.
- Brand name MUST flow through `{storeDetail?.name}` — see canonical/brand-name.
- Hero MUST include: headline, supporting copy, CTA button, visual area.
- Homepage MUST include at least these 5 retail sections unless the user explicitly requests fewer: Hero, Featured Products, Trust/Social Proof, Category/Benefit Band, Newsletter/Final CTA.
- Product/category visuals must prefer real product images via product.image ?? product.images?.[0]. If images are missing, use intentional branded placeholders built from DESIGN.md token utilities (token-safe gradients, labels, badges, abstract shapes). Never use empty gray blocks, invented external image URLs, or fake app/dashboard UI built from divs.
- Use product data from src/data/products.ts.
- Use website config from src/lib/website-config.ts.
- Align storefront UI with DESIGN.md sections 1-8 and front-matter dials/locks when present. Prefer semantic token utilities (bg-primary, text-foreground, border-border, etc.) over random raw Tailwind palette classes. The taste skill is the primary guide for layout, polish, and anti-generic patterns.
- StoreProvider loading state must be implemented in StorefrontLoadingScreen as a branded animated icon loading UI using DESIGN.md semantic colors and a clear commerce/store icon treatment (for example a Lucide Store, ShoppingBag, or LoaderCircle icon). It must include accessible loading text and visible motion/state. StorefrontLoadingScreen must not render skeleton UI: no Skeleton component, animate-pulse placeholders, gray bars/boxes, simulated header/product-card grid, placeholder cards, plain text-only state, empty screen, or bare generic spinner.
{{include:canonical/brand-name.md}}

{{include:canonical/ui-tokens.md}}

PROJECT RULE DOCS (authoritative project-specific reference):
{{projectRuleDocs}}
