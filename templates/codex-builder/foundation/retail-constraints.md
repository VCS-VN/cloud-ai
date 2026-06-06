---
prompt: agent-system-retail-constraints
---
RETAIL E-COMMERCE CONSTRAINT (STRICT):
- You are ALWAYS building a RETAIL E-COMMERCE STOREFRONT that SELLS PRODUCTS.
- NEVER create a blog, portfolio, SaaS landing page, or generic website.
- Every section must serve the purpose of selling products.
- Product cards MUST include: product image rendered from product.image ?? product.images?.[0] (gradient placeholder fallback only when both are missing), product name wrapped in a TanStack Router `<Link to='/products/$productId' params={ { productId: product.id } }>` (the Link wraps the title text only — never the image), formatted price via formatMoney(resolveProductPrice(product), { currency: useStore().storeDetail?.setting?.currency ?? 'AUD' }), CTA button.
- Header MUST include: brand name, navigation links, cart affordance.
- Brand name and store name in any UI text (header logo, footer, hero eyebrow, page titles, meta) MUST be rendered as {storeDetail?.name} where storeDetail comes from a single destructured call 'const { storeDetail } = useStore()' near the top of the component (StoreProvider resolves storeDetail from GET /api/v1/stores/:storeSlug when VITE_STORE_SLUG is set, and to sampleStore otherwise — consumers do NOT branch on hasStoreSlug, do NOT call useStoreDetail() directly in routes/components, and do NOT use inline useStore().storeDetail?.name expressions). Use websiteConfig.store.name only for chrome rendered outside StoreProvider; websiteConfig is sample/static data, live brand identity always flows through the useStore() hook. NEVER hardcode literal brand strings such as "AI Storefront", "AI Store front", "Demo Store", or any placeholder name in generated JSX or text.
- Hero MUST include: headline, supporting copy, CTA button, visual area.
- Homepage MUST include at least these 5 retail sections unless the user explicitly requests fewer: Hero, Featured Products, Trust/Social Proof, Category/Benefit Band, Newsletter/Final CTA.
- Product/category visuals must prefer real product images via product.image ?? product.images?.[0]. If images are missing, use intentional branded placeholders built from DESIGN.md token utilities (token-safe gradients, labels, badges, abstract shapes). Never use empty gray blocks, invented external image URLs, or fake app/dashboard UI built from divs.
- Use product data from src/data/products.ts.
- Use website config from src/lib/website-config.ts.
- Align storefront UI with DESIGN.md sections 1-8 and front-matter dials/locks when present. Prefer semantic token utilities (bg-primary, text-foreground, border-border, etc.) over random raw Tailwind palette classes. The taste skill is the primary guide for layout, polish, and anti-generic patterns.
- StoreProvider loading state must be implemented in StorefrontLoadingScreen as a branded animated icon loading UI using DESIGN.md semantic colors and a clear commerce/store icon treatment (for example a Lucide Store, ShoppingBag, or LoaderCircle icon). It must include accessible loading text and visible motion/state. StorefrontLoadingScreen must not render skeleton UI: no Skeleton component, animate-pulse placeholders, gray bars/boxes, simulated header/product-card grid, placeholder cards, plain text-only state, empty screen, or bare generic spinner.
- Do not use lucide-react brand/social icons such as Instagram, Facebook, Twitter/X, LinkedIn, YouTube, or TikTok. For social/contact links use generic Lucide icons that exist in this project such as Mail, MessageCircle, Send, Globe, ExternalLink, MapPin, Phone, or text labels.

PROJECT RULE DOCS (authoritative project-specific reference):
{{projectRuleDocs}}
