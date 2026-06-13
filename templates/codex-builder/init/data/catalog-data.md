---
layer: CATALOG_DATA
warning: >
  Catalog sample data và hợp đồng hiển thị sản phẩm. Gửi nguyên văn tới model.
  Bỏ qua layer này → agent có thể rewrite data hoặc bỏ qua product grid.
---
CATALOG DATA (CREATE THESE DATA ENTITY FILES — they back the hook sample fallbacks):

Create these three data files. The store hooks under `src/services/store/*` import them internally for their sample fallback, so they MUST exist before the hooks and components are written. Match the store brief (product names, categories, prices, descriptions all themed to this store).

- `src/data/products.ts` — `export const products: Product[]` with 8–12 themed sample products. Every product MUST include a `descriptions` field. Each product: `{ id: string (slug), name: string, descriptions: string (REQUIRED — HTML string, e.g. "<p>…</p><ul><li>…</li></ul>"), image?: string, images?: string[], category: { id: string, name: string }, price: number (INTEGER CENTS, e.g. 1899 = $18.99), compareAtPrice?: number (cents), defaultModel?: { id: string, name: string, price: number }, models?: { id: string, name: string, price: number }[] }`. Prices are integer cents — never decimals. `descriptions` (plural) is a REQUIRED field and MUST be a rich-text HTML string — never plain text, never empty, never omitted. Write 2–4 short sentences of shopper-facing copy using semantic HTML tags (`<p>`, `<ul>`/`<li>`, `<strong>`); e.g. `<p>Hand-thrown stoneware finished with a matte glaze.</p><ul><li>Dishwasher safe</li><li>12 oz capacity</li></ul>`. There is NO singular `description` field. Use real-looking image URLs or omit image/images (the UI falls back to a seeded picsum photo). Re-declare a local `type Product = { … }` at the top of the file (the canonical type also lives in the hooks; a structurally-identical local type here is fine since this file is a leaf sample source).
- `src/data/categories.ts` — `export const categories: Category[]` with 3–6 themed categories. Each: `{ id: string (slug), name: string, storeId?: string }`. The product `category.id`/`category.name` values MUST reference these categories so filtering works.
- `src/data/sample-store.ts` — `export const sampleStore` of shape `{ id: string, name: string, slug: string, setting: { currency: string } }`. `setting.currency` defaults to `'AUD'`. `name` is the themed store name. This is the slug-missing fallback returned by StoreProvider.

- Routes and store components MUST NOT import `@/data/products` or `@/data/categories` directly. Always consume catalog through hooks (`useProductsList`, `useProductDetail`, `useCategoriesList`) per the data contract. ONLY the hook implementations under `src/services/store/*` import these data files (for their sample fallback).
- Before finishing init, the storefront MUST show a real product catalog:
  - Create `src/components/store/product-card.tsx` and `src/components/store/product-grid.tsx` (recommended), or keep an inline grid in routes if minimal.
  - Home (`src/routes/index.tsx`) and `/products` MUST render products via `useProductsList({ storeId })` with loading and empty states.
  - Product detail MUST use `useProductDetail(productId)` for PDP content.
- Follow store-runtime infinite-scroll patterns when expanding the products page beyond the seed grid.

DESCRIPTIONS RENDERING RULE (hard rule):
- `product.descriptions` is an HTML string. When rendering it anywhere (product card preview, product detail page, or any component), you MUST sanitize it with DOMPurify before injecting into the DOM to prevent XSS.
- Canonical pattern (reuse exactly): `import DOMPurify from 'dompurify'`, then `const sanitizedDescriptions = useMemo(() => { const html = product.descriptions ?? ''; return typeof window !== 'undefined' ? DOMPurify.sanitize(html) : escapeHtml(html) }, [product.descriptions])`. Render via `dangerouslySetInnerHTML={{ __html: sanitizedDescriptions }}` on a wrapping `<div>` (NOT a `<p>` — the HTML may contain block-level tags like `<ul>`).
- `escapeHtml` is an inline helper: `const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')`. The `typeof window !== 'undefined'` guard is REQUIRED because DOMPurify accesses `window` and will crash during SSR (Node.js).
- NEVER render `{product.descriptions}` as raw JSX text, and NEVER pass the unsanitized string to `dangerouslySetInnerHTML`.

CUSTOMER-FACING COPY (hard rule):

- Every string in `src/routes/**` and `src/components/**` is shopper-facing copy.
- Never show builder/agent jargon in UI: no "taste skill", "route shell", "thin shell", "design taste", debug `Shell — q=…`, or "Build … using the design …" placeholders.
- Write retail-neutral text (product names, prices, empty states, loading messages) only.
