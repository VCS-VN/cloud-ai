---
layer: SYSTEM
warning: >
  Nội dung dưới phần frontmatter này được gửi NGUYÊN VĂN tới model khi khởi tạo
  project. Frontmatter (khối --- này) bị strip trước khi gửi. Đừng sửa nếu bạn
  không hiểu luồng init — sai một dòng có thể làm storefront sinh ra bị lỗi.
---
FIRST call project_read_taste_skill to load the anti-slop design skill (the authoritative UI taste guide). THEN author THIS project's DESIGN.md yourself using project_create_file: a complete visual identity driven by the skill and the store brief below — YAML front-matter with 15 hex color tokens, plus typography, spacing, components, and layout sections. THEN call project_read_design_rules to load the DESIGN.md you just wrote (this is REQUIRED before any UI mutation). THEN create the files listed below using project_create_file.
Do NOT inspect existing files. After loading the skill, authoring DESIGN.md, and loading design rules, CREATE the files directly.
This is a retail e-commerce (online store) project. Every page and component must serve a storefront shopping experience.

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
Generated storefront API requests MUST always go through `apiClient` from `@/services/http/client`. NEVER use native `fetch` for customer/store API requests. Store hooks MUST import `import { apiClient } from '@/services/http/client'` and call `apiClient.get(...)` with `params`; do not use URLSearchParams, response.json(), or fetch('/api/...').

BEFORE CREATING FILES — REQUIRED RULES TO PREVENT ERRORS:

1. NO TOP-LEVEL JSX: Every .tsx file MUST wrap ALL JSX inside a function/component. No JSX expressions at module top-level. Route files created with createFileRoute MUST place all JSX inside the route component function, never at file scope.

2. COMPLETE IMPORTS: Every file MUST explicitly import every React hook (useState, useEffect, useRef, useMemo, useCallback), every component (Link, Button, etc.), every UI primitive from @/components/ui/*, and every type it uses. Do not rely on implicit globals or auto-imports. The Agent MUST NOT assume any name is available without an explicit import statement.

3. DOMPurify SSR GUARD: DOMPurify.sanitize() calls window internally and WILL crash in SSR (Node.js). Wrap EVERY sanitize call: `typeof window !== 'undefined' ? DOMPurify.sanitize(html) : escapeHtml(html)`. Define escapeHtml inline as `const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')` or import from @/lib/utils if available. NEVER call DOMPurify.sanitize unconditionally at module scope or inside a component without the typeof window guard.

4. OPTIONAL SEARCH PARAMS: All validateSearch fields in createFileRoute MUST be optional with sensible defaults. Use inline coercion with fallback (e.g., `typeof search.q === 'string' ? search.q.trim() : ''`, `Number(search.page) || 1`). Never declare a search param as required when it maps to a URL query string. Every validateSearch field must have a default value so the route works with zero query params.

5. AXIOS .data UNWRAP: When using `apiClient.get<T>(url, { params })`, the response is `AxiosResponse<T>`. The queryFn inside useQuery/useInfiniteQuery MUST return `response.data` (the unwrapped payload of type T), NOT the full AxiosResponse. The hook consumer then reads `query.data` which will be the unwrapped T. Example correct pattern: `queryFn: async () => { const res = await apiClient.get<T>(url); return res.data; }`.

6. POST-GENERATION VALIDATION (MANDATORY): After creating ALL files with project_create_file, call `project_run_validation` with `level: 'fast'` and `reason: 'typecheck generated storefront files'`. Fix every error with project_apply_patch before declaring the task complete. If validation fails: inspect the error, apply the minimal fix, re-run validation. Repeat until validation passes. NEVER skip validation or leave errors unaddressed.

NOW START: call project_read_taste_skill, then author DESIGN.md with project_create_file, then project_read_design_rules, then create ALL files using project_create_file.