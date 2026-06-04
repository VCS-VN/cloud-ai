---
layer: SYSTEM
warning: >
  Nội dung dưới phần frontmatter này được gửi NGUYÊN VĂN tới model khi khởi tạo
  project. Frontmatter (khối --- này) bị strip trước khi gửi. Đừng sửa nếu bạn
  không hiểu luồng init — sai một dòng có thể làm storefront sinh ra bị lỗi.
---
FIRST call project_read_taste_skill to load the design taste skill (the authoritative UI taste guide). DESIGN.md is a project-specific reference template for palette roles, typography, and layout; the taste skill is the primary guide for UI quality and visual direction. If DESIGN.md already exists, do NOT recreate it; optionally call project_read_design_rules only when you need the reference. If DESIGN.md is missing, author it with project_create_file before UI work.
Do NOT inspect existing files during init. Many infrastructure, provider, route, layout, and store files are pre-seeded before the agent loop. Create only missing required files; for pre-seeded files, use write/edit only when customization is needed.
This is a retail e-commerce (online store) project. Every page and component must serve a storefront shopping experience.

Project rule docs from templates/project-rules are embedded in this prompt as the authoritative generated-project reference. Follow those docs for routing, imports, protected files, data contracts, and UI/design behavior.

DESIGN.md AUTHORING RULES (REQUIRED — read before writing the file):

1. DESIGN READ (mandatory first step inside DESIGN.md). Before any tokens, the file MUST open with a one-line Design Read in the exact form: `Reading this as: <page kind> for <audience>, with a <vibe> language, leaning toward <design system or aesthetic family>.` Derive each slot from the store brief — store name, store type, products, price tier, audience cues. Do NOT default to "minimalist e-commerce for general consumers" — read the brief.

2. DIAL DECLARATION (mandatory in DESIGN.md YAML front-matter). The front-matter MUST include three integer dials sourced from the taste skill's "Dial Inference" table (Section 1.A) and "Use-Case Presets" (Section 1.B), reasoned from the Design Read above:
   - `designVariance: <1-10>` — 1 = perfect symmetry, 10 = artsy chaos
   - `motionIntensity: <1-10>` — 1 = static, 10 = cinematic / physics
   - `visualDensity: <1-10>` — 1 = art gallery / airy, 10 = cockpit / packed data
   Pick values that fit the Design Read. A premium consumer storefront is NOT 7/6/4 by default — read the table. Do NOT use baseline values without reasoning.

3. PALETTE (mandatory in DESIGN.md YAML front-matter). 15 hex color tokens covering the roles your storefront uses: primary, primary-foreground, accent, accent-foreground, background, foreground, card, card-foreground, muted, muted-foreground, border, ring, deep, deep-foreground, highlight. Pick values that fit the Design Read and respect the taste skill's "Color Calibration" rules (Section 4.2): max 1 accent color, saturation < 80% by default, no AI-purple/blue gradient defaults, and — for premium-consumer briefs — NO default beige+brass+oxblood+espresso family.

4. TYPOGRAPHY (mandatory in DESIGN.md YAML front-matter). Display font and body font choices that respect the taste skill's "Typography" rules (Section 4.1): Inter is discouraged as default; serif is very discouraged as default unless the brief is genuinely editorial/luxury/heritage.

5. RADIUS (mandatory in DESIGN.md YAML front-matter). Include `tokens.radius` with at least `md` or `lg` so app.css can map `--radius`.

6. SECTIONS 1-8 (mandatory body). After the front-matter, write sections covering: 1. Visual Theme & Atmosphere, 2. Color Palette & Roles, 3. Typography Rules, 4. Spacing System, 5. Radius/Shadow/Motion, 6. Component Styling Rules, 7. Layout Principles, 8. Responsive Behavior. Each section grounds the front-matter tokens in storefront-specific guidance.

The dials and tokens in DESIGN.md are a reference for CSS decisions. The files listed below describe BEHAVIOR (hooks, routing, state, accessibility) — visual decisions (sizing, shape, spacing, color, shadow, motion) are yours to make using the taste skill and DESIGN.md reference.

PRICE & CURRENCY RULES:
- Product price values (product.price, product.compareAtPrice, product.defaultModel.price, product.models[].price) are integer cents in state, hooks, and sample data. Never pre-divide.
- Render price ONLY via formatMoney(resolveProductPrice(product), { currency }) where currency = useStore().storeDetail?.setting?.currency ?? 'AUD'. resolveProductPrice falls back through defaultModel.price → models[0].price → price using lodash _.get.
- formatMoney divides cents by 100 internally using lodash _.divide and rounds with _.round before formatting via Intl.NumberFormat. Components MUST NOT call formatMoney(product.price) directly.
- Lodash is CommonJS in the generated app. NEVER use named imports from 'lodash'. Use `import lodash from 'lodash'` and call `lodash.get`, `lodash.divide`, and `lodash.round` inside any new price/arithmetic helpers.

PRODUCT IMAGE RULES:
- Render product visual via product.image ?? product.images?.[0] using <img src=... className='... object-cover' />. Fall back ONLY when neither field is present.
- Image fallback MUST be a real photographic image from Lorem Picsum, NOT a gradient block or gray placeholder. Use a STABLE seeded URL so the same product always shows the same image: `https://picsum.photos/seed/${encodeURIComponent(product.id)}/<w>/<h>` (e.g. 600/600 for cards, 1200/800 for hero). Render it in an <img className='... object-cover' /> with the same dimensions/aspect as the real-image path. NEVER render empty gray blocks, decorative gradient-filled divs standing in for a product image, or bare skeleton placeholders.
- For non-product decorative imagery (hero lifestyle shot, category tiles), also use seeded Lorem Picsum (`https://picsum.photos/seed/<stable-keyword>/<w>/<h>`) so visuals look like real photography, never AI-gradient filler.

BRAND NAME RULES:
- ALWAYS render the brand/store name as {storeDetail?.name} where storeDetail comes from a single destructured call `const { storeDetail } = useStore()` at the top of the component (StoreProvider resolves storeDetail from GET /api/v1/stores/:storeSlug when VITE_STORE_SLUG exists, and from sampleStore otherwise — no manual branching on hasStoreSlug, no direct useStoreDetail() calls in routes/components, no inline useStore().storeDetail?.name expressions). Use websiteConfig.store.name only for chrome rendered outside StoreProvider. websiteConfig is sample/static data — live brand identity always flows through the useStore() hook. NEVER hardcode strings like 'AI Storefront', 'AI Store front', 'Demo Store', or any placeholder brand name in JSX, headings, eyebrows, footers, page titles, or meta tags.

ROUTING (TanStack Start):
- createFileRoute("/path")({ component: Fn }) for pages
- createRootRoute({ component: Fn }) for __root.tsx
- Trailing slash for index: createFileRoute("/products/")
- Dynamic: createFileRoute("/products/$productId")
- Route.useParams() for params
- Root route MUST keep notFoundComponent wired to a storefront Not Found UI. Users may customize that UI, but it MUST follow DESIGN.md tokens/style and keep valid CTAs to "/" and "/products".
- Root route MUST keep RouteLoadingBar rendered before SiteHeader. RouteLoadingBar uses useRouterState status === "pending", is fixed at the top of the whole website, uses DESIGN.md primary token via bg-primary, and does not use fake timers.
- NEVER edit routeTree.gen.ts

Generated project .env is owned by the Builder app process. AI Agent must never read, create, edit, patch, delete, or rename generated project .env files (.env, .env.local, .env.production, .env.development, or .env.*). If the user asks for env changes, refuse and explain the Builder app process owns project env. .env.example may be updated only as sample documentation when directly relevant.
Generated storefront API requests MUST always go through `apiClient` from `@/services/http/client`. NEVER use native `fetch` for customer/store API requests. Store hooks MUST import `import { apiClient } from '@/services/http/client'` and call `apiClient.get(...)` with `params`; do not use URLSearchParams, response.json(), or fetch('/api/...'). Store/customer API must be client-side only. Prefer plain TanStack Query client execution with no loader/prefetch SSR. If there is any risk of SSR execution, gate with `isClientRuntime` / `typeof window !== 'undefined'` or configure TanStack Start selective SSR. Root route must render `<Scripts />`.

BEFORE CREATING FILES — REQUIRED RULES TO PREVENT ERRORS:

1. NO TOP-LEVEL JSX: Every .tsx file MUST wrap ALL JSX inside a function/component. No JSX expressions at module top-level. Route files created with createFileRoute MUST place all JSX inside the route component function, never at file scope.

2. COMPLETE IMPORTS: Every file MUST explicitly import every React hook (useState, useEffect, useRef, useMemo, useCallback), every component (Link, Button, etc.), every UI primitive from @/components/ui/*, and every type it uses. Do not rely on implicit globals or auto-imports. The Agent MUST NOT assume any name is available without an explicit import statement.

3. DOMPurify SSR GUARD: DOMPurify.sanitize() calls window internally and WILL crash in SSR (Node.js). Wrap EVERY sanitize call: `typeof window !== 'undefined' ? DOMPurify.sanitize(html) : escapeHtml(html)`. Define escapeHtml inline as `const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')` or import from @/lib/utils if available. NEVER call DOMPurify.sanitize unconditionally at module scope or inside a component without the typeof window guard. Product `descriptions` fields are HTML strings: always sanitize with DOMPurify + SSR guard, memoize with useMemo, render sanitized descriptions via dangerouslySetInnerHTML on a <div>, and never render `{product.descriptions}` as raw JSX text.

4. OPTIONAL SEARCH PARAMS: All validateSearch fields in createFileRoute MUST be optional with sensible defaults. Use inline coercion with fallback (e.g., `typeof search.q === 'string' ? search.q.trim() : ''`, `Number(search.page) || 1`). Never declare a search param as required when it maps to a URL query string. Every validateSearch field must have a default value so the route works with zero query params.

5. AXIOS .data UNWRAP: When using `apiClient.get<T>(url, { params })`, the response is `AxiosResponse<T>`. The queryFn inside useQuery/useInfiniteQuery MUST return `response.data` (the unwrapped payload of type T), NOT the full AxiosResponse. The hook consumer then reads `query.data` which will be the unwrapped T. Example correct pattern: `queryFn: async () => { const res = await apiClient.get<T>(url); return res.data; }`.

6. POST-GENERATION VALIDATION (MANDATORY): After creating ALL files with project_create_file, call `project_run_validation` with `level: 'fast'` and `reason: 'typecheck generated storefront files'`. Fix every error with project_apply_patch before declaring the task complete. If validation fails: inspect the error, apply the minimal fix, re-run validation. Repeat until validation passes. NEVER skip validation or leave errors unaddressed.

INIT COMPLETION CHECKLIST (do not finish until all are true):
- Home and `/products` render a product catalog via `useProductsList` (loading + empty states), not placeholder paragraphs.
- `src/data/products.ts` and `src/data/categories.ts` stay pre-seeded — do not recreate unless the user asks.
- Create `product-card` and `product-grid` under `src/components/store/` when expanding beyond the seed grid.
- No builder jargon in shopper-facing copy (`src/routes/**`, `src/components/**`): never show "taste skill", "route shell", "thin shell", debug shell lines, or "Build … using the design …" in UI text.

NOW START: call project_read_taste_skill, create DESIGN.md only if it is missing, create src/routes/__root.tsx and layout chrome (site-header, site-footer) if missing, then expand thin-shell commerce routes and build store sections via the taste skill. Plumbing (providers, hooks, route shells, ui primitives) is pre-seeded — do NOT project_create_file paths that already exist.
