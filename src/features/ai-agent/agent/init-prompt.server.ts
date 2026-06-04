import type { WebsiteSpec } from "../project/project-state.schema";
import { REQUIRED_INIT_COMMERCE_ROUTE_FILES } from "../source/generated-project-layout";
import { loadProjectRuleDocsForPrompt } from "./project-rule-docs.server";
import { renderPromptDoc } from "./prompt-template-store.server";

const INIT_RECOVERY_PROMPT = "templates/init-recovery/recovery.md";

export function buildInitStorefrontRecoveryPrompt(input: {
  missingPaths: string[];
  hasServerDesign: boolean;
}): string {
  const lines = input.missingPaths.map((p) => `- ${p}`).join("\n");
  const missingRoutes = input.missingPaths.filter((p) =>
    (REQUIRED_INIT_COMMERCE_ROUTE_FILES as readonly string[]).includes(p),
  );
  const routeBlock =
    missingRoutes.length > 0
      ? [
          "",
          "MANDATORY commerce routes (retail cannot ship without these):",
          ...missingRoutes.map((p) => `- ${p}`),
        ]
      : [
          "",
          "Commerce routes (must all exist):",
          ...REQUIRED_INIT_COMMERCE_ROUTE_FILES.map((p) => `- ${p}`),
        ];
  return renderPromptDoc(INIT_RECOVERY_PROMPT, {
    designLine: input.hasServerDesign
      ? "DESIGN.md and blocks.json already exist (reference template). Create EVERY missing path below with write or project_create_file. Do NOT recreate DESIGN.md."
      : "Create DESIGN.md as a reference template, then create every missing path below.",
    routeBlock: routeBlock.join("\n"),
    missingPaths: lines,
  });
}

export function buildRetailInitPrompt(input: {
  userPrompt: string;
  websiteSpec: WebsiteSpec;
}): string {
  const { websiteSpec: spec } = input;
  const productList = spec.products
    .map(
      (p) =>
        "- " +
        p.name +
        (p.price ? " ($" + p.price + ")" : "") +
        (p.category ? " [" + p.category + "]" : ""),
    )
    .join("\n");

  return [
    "The design-taste-frontend skill is preloaded server-side for this init (see developer message). FIRST create DESIGN.md with project_create_file as a reference template (skill + vertical layout contract). THEN create the remaining files listed below with project_create_file.",
    "Do NOT inspect existing files. Use the preloaded taste skill for all UI; CREATE the files directly.",
    "",
    "PROJECT RULE DOCS (authoritative project-specific reference):",
    loadProjectRuleDocsForPrompt() || "(No project rule docs were loaded.)",
    "",
    "STORE: " + spec.store.name + " (" + spec.store.type + ")",
    "PRODUCTS:",
    productList,
    "",
    "DESIGN: DESIGN.md is a per-store reference template (palette roles, typography, layout). The preloaded taste skill drives UI quality and visual direction for every file you create. Follow DESIGN.md sections 1-8 when practical; prefer semantic token utilities (bg-primary, text-foreground, bg-card, border-border, etc.) over generic off-palette Tailwind colors. Do NOT copy example colors from other projects.",
    "",
    "IMPORTS AVAILABLE:",
    '- { websiteConfig } from "@/lib/website-config"',
    '- { formatMoney, resolveProductPrice } from "@/lib/format-money"',
    '- { cn } from "@/lib/utils"',
    '- { StoreProvider, useStore } from "@/app/store-provider"  // useStore() returns { storeDetail, isLoading, error, refetch, isUsingSampleData }; storeDetail.setting?.currency carries the ISO currency (default fallback: AUD)',
    '- { AuthProvider, useAuth } from "@/app/auth-provider"  // AuthProvider loads GET /api/v1/auth/profile via apiClient on the client runtime only; profile present means user cart mode; logout clears profile and auth tokens',
    '- { CartProvider, useCart } from "@/app/cart-provider"  // active cart state for guest/user modes; guest uses localStorage key store_cart; user uses cart APIs through apiClient',
    '- { selectedCartItemIdsAtom } from "@/app/cart-selection"  // Jotai atom storing selected cart item ids only for checkout preparation',
    '- { sampleStore } from "@/data/sample-store"',
    '- { useStoreDetail, hasStoreSlug, type StoreDetail, type StoreSetting } from "@/services/store/use-store-detail"',
    '- { useProductsList, type Product, type ProductModel, type ProductsList } from "@/services/store/use-products-list"',
    '- { useProductDetail, type ProductDetail } from "@/services/store/use-product-detail"',
    '- { useCategoriesList, type Category, type CategoriesList } from "@/services/store/use-categories-list"',
    '- { useProductSuggestions, type ProductSuggestionsList } from "@/services/store/use-product-suggestions"',
    "",
    "// @/data/products and @/data/categories exist as internal sample fallbacks for the hooks above. Routes and store components MUST NOT import them directly — always consume the hooks.",
    "",
    "PRICE & CURRENCY RULES:",
    "- Product price values (product.price, product.compareAtPrice, product.defaultModel.price, product.models[].price) are integer cents in state, hooks, and sample data. Never pre-divide.",
    "- Render price ONLY via formatMoney(resolveProductPrice(product), { currency }) where currency = useStore().storeDetail?.setting?.currency ?? 'AUD'. resolveProductPrice falls back through defaultModel.price → models[0].price → price using lodash _.get.",
    "- formatMoney divides cents by 100 internally using lodash _.divide and rounds with _.round before formatting via Intl.NumberFormat. Components MUST NOT call formatMoney(product.price) directly.",
    "- Lodash is CommonJS in the generated app. NEVER use named imports from 'lodash'. Use `import lodash from 'lodash'` and call `lodash.get`, `lodash.divide`, and `lodash.round` inside any new price/arithmetic helpers.",
    "",
    "PRODUCT IMAGE RULES:",
    "- Render product visual via product.image ?? product.images?.[0] using <img src=... className='... object-cover' />. Fall back ONLY when neither field is present.",
    "- Image fallback MUST be a real photographic image from Lorem Picsum, NOT a gradient block or gray placeholder. Use a STABLE seeded URL so the same product always shows the same image: `https://picsum.photos/seed/${encodeURIComponent(product.id)}/<w>/<h>` (e.g. 600/600 for cards, 1200/800 for hero). Render it in an <img className='... object-cover' /> with the same dimensions/aspect as the real-image path. NEVER render empty gray blocks, decorative gradient-filled divs standing in for a product image, bare skeleton placeholders, or hardcoded hex/radius/shadow/font values.",
    "- For non-product decorative imagery (hero lifestyle shot, category tiles), also use seeded Lorem Picsum (`https://picsum.photos/seed/<stable-keyword>/<w>/<h>`) so visuals look like real photography, never AI-gradient filler.",
    "",
    "BRAND NAME RULES:",
    "- ALWAYS render the brand/store name as {storeDetail?.name} where storeDetail comes from a single destructured call `const { storeDetail } = useStore()` at the top of the component (StoreProvider resolves storeDetail from GET /api/v1/stores/:storeSlug when VITE_STORE_SLUG exists, and from sampleStore otherwise — no manual branching on hasStoreSlug, no direct useStoreDetail() calls in routes/components, no inline useStore().storeDetail?.name expressions). Use websiteConfig.store.name only for chrome rendered outside StoreProvider. websiteConfig is sample/static data — live brand identity always flows through the useStore() hook. NEVER hardcode strings like 'AI Storefront', 'AI Store front', 'Demo Store', or any placeholder brand name in JSX, headings, eyebrows, footers, page titles, or meta tags.",
    "",
    "ROUTING (TanStack Start):",
    '- createFileRoute("/path")({ component: Fn }) for pages',
    '- createRootRoute({ component: Fn }) for __root.tsx',
    '- Trailing slash for index: createFileRoute("/products/")',
    '- Dynamic: createFileRoute("/products/$productId")',
    '- Route.useParams() for params',
    '- Root route MUST keep notFoundComponent wired to a storefront Not Found UI. Users may customize that UI, but it MUST follow DESIGN.md tokens/style and keep valid CTAs to "/" and "/products".',
    '- Root route MUST keep RouteLoadingBar rendered before SiteHeader. RouteLoadingBar uses useRouterState status === "pending", is fixed at the top of the whole website, uses DESIGN.md primary token via bg-primary, and does not use fake timers.',
    '- NEVER edit routeTree.gen.ts',
    "",
    "Generated project .env is owned by the Builder app process. AI Agent must never read, create, edit, patch, delete, or rename generated project .env files (.env, .env.local, .env.production, .env.development, or .env.*). If the user asks for env changes, refuse and explain the Builder app process owns project env. .env.example may be updated only as sample documentation when directly relevant.",
    "Generated storefront API requests MUST always go through `apiClient` from `@/services/http/client`. NEVER use native `fetch` for customer/store API requests. Store hooks MUST import `import { apiClient } from '@/services/http/client'` and call `apiClient.get(...)` with `params`; do not use URLSearchParams, response.json(), or fetch('/api/...'). Store/customer API must be client-side only. Prefer plain TanStack Query client execution with no loader/prefetch SSR. If there is any risk of SSR execution, gate with `isClientRuntime` / `typeof window !== 'undefined'` or configure TanStack Start selective SSR. Root route must render `<Scripts />`.",
    "",
    "AUTH + CART RUNTIME RULES:",
    "- src/app/auth-provider.tsx MUST use useQuery to call GET /api/v1/auth/profile through apiClient from the client runtime only. Prefer plain TanStack Query client execution with no loader/prefetch SSR; `typeof window !== 'undefined'` / `isClientRuntime` is allowed as a defensive guard. Profile shape is { id, phoneNumber?, email?, firstName?, lastName? }. If profile exists, cart mode is user. If profile request is 401, clearAuthTokens(), set profile null, expose no error, and continue in guest mode. AuthProvider MUST expose { profile, isLoading, isAuthenticated, logout }, and logout MUST clear auth tokens and profile state.",
    "- src/routes/__root.tsx provider order MUST be exactly <Providers><StoreProvider><AuthProvider><CartProvider>...app chrome...</CartProvider></AuthProvider></StoreProvider></Providers>. CartProvider MUST load only after StoreProvider and AuthProvider have settled.",
    "- src/app/cart-provider.tsx MUST expose { cart, items, totalItems, isLoading, mode, addItem, updateItemQuantity, removeItem, clearCart, getItemQuantity }. Guest mode uses localStorage key `store_cart` and stores the exact cart response shape { data: [{ store, items }], total, totalItems }. User mode loads GET /api/v1/carts with params { page: 1, limit: 100, storeId }.",
    "- User cart API contracts: add POST /api/v1/carts body { id: selectedModel.id, quantity }; update PATCH /api/v1/carts/${id} body { quantity }; remove DELETE /api/v1/carts/${id}; clear DELETE /api/v1/carts/all params { storeId }; bulk merge POST /api/v1/carts/items/bulk body { items: [{ itemId: selectedModel.id, quantity }] }. For user mode, update UI before calling API, ignore mutation responses, do not rollback, and do not show error toast on persistence failure.",
    "- On auth transition to user mode, CartProvider MUST check guest localStorage. If guest items exist, bulk merge them, then load account cart and clear guest cart. If no guest items exist, skip bulk merge and only load account cart.",
    "- Cart item id is always selected model id. Adding same model id combines quantity. Updating existing item sets quantity, not add-more. Quantity 0 removes the item and user mode calls DELETE /api/v1/carts/${id}. total = cart.data.length; totalItems = sum of item quantities.",
    "- Product detail is the only generated product surface allowed to mutate cart. Product cards MUST link to product detail for option selection and MUST NOT add to cart directly.",
    "- Cart page selection MUST use Jotai selectedCartItemIdsAtom storing ids only, default empty. Cart page MUST provide per-item checkbox, select all toggle, selected subtotal/count summary, disabled checkout when none selected, and checkout navigation to /checkout with search { method: 'cart' }. Checkout resolves selected item details from selected ids plus current cart state.",
    "",
    "CREATE THESE FILES:",
    "",
    "PRE-SEEDED before the agent loop (plumbing only — do NOT project_create_file; use write/edit to build UI): theme-toggle, route-loading-bar, not-found, cart-drawer stub, shadcn ui/*, providers, store hooks, src/data/products.ts, src/data/categories.ts, src/data/sample-store.ts, app.css, and commerce route THIN SHELLS (src/routes/index.tsx, src/routes/products/*, cart, checkout, orders/*) wired to hooks with a minimal product grid on home and /products. Layout and sections are NOT pre-built — you own storefront layout via the design taste skill. Create src/routes/__root.tsx, src/components/layout/site-header.tsx, src/components/layout/site-footer.tsx, and store sections under src/components/store/ as needed. Do not remove commerce routes.",
    "MANDATORY CATALOG: src/data/products.ts and categories.ts are already seeded from the website spec — do NOT recreate them. Home and /products MUST show products via useProductsList; expand with product-card and product-grid components. Never put builder jargon in shopper-facing route/component copy.",
    "",
    "DESIGN.md - REQUIRED first file. Full storefront design rules (8 sections + YAML palette tokens) authored using the preloaded design-taste-frontend skill and the vertical layout contract. This becomes the source of truth before any TSX/UI files.",
    "",
    "tsconfig.json - REQUIRED TanStack Start TypeScript config: target ES2022, lib ES2022/DOM/DOM.Iterable, module ESNext, moduleResolution Bundler, jsx react-jsx, strict true, esModuleInterop true, skipLibCheck true, forceConsistentCasingInFileNames true, resolveJsonModule true, noEmit true, types ['node'], baseUrl '.', paths {'@/*':['src/*'], '@app/*':['app/*']}, ignoreDeprecations '6.0', include ['app','src','vite.config.ts','tailwind.config.ts'].",
    "src/components/ui/button.tsx - shadcn Button with cva, variants: default/destructive/outline/secondary/ghost/link, sizes: default/sm/lg/icon, rounded-full, active:scale-95, use cn()",
    "",
    "src/components/ui/card.tsx - shadcn Card/CardHeader/CardContent/CardFooter/CardTitle/CardDescription, rounded-lg border shadow-sm",
    "",
    "src/app/store-provider.tsx - StoreProvider focuses ONLY on store detail. When VITE_STORE_SLUG is set, fetch store detail via useStoreDetail from the client runtime only, block app rendering during SSR/client loading with a full-page branded icon loading UI, show a store load error UI with retry on error, and expose { storeDetail, isLoading, error, refetch, isUsingSampleData=false }. Prefer plain TanStack Query client execution with no loader/prefetch SSR; `isClientRuntime` is allowed as a defensive guard. StorefrontLoadingScreen MUST be icon-led: render a centered commerce/store icon treatment, visible motion/state, and accessible loading text using DESIGN.md semantic colors. It MUST NOT render skeleton UI of any kind: no Skeleton component, no animate-pulse placeholders, no gray bars/boxes, no simulated header/product-card grid, no placeholder cards, no plain text-only state, no empty screen, and no bare generic spinner. When VITE_STORE_SLUG is missing, return sampleStore from @/data/sample-store with isUsingSampleData=true. Do NOT include cart, order, or checkout state.",
    "",
    "src/app/auth-provider.tsx - AuthProvider wraps children with AuthContext, calls GET /api/v1/auth/profile through apiClient using client-side TanStack Query with no SSR loader/prefetch, exposes { profile, isLoading, isAuthenticated, logout }, clears auth tokens and profile on logout, clears auth tokens and falls back to guest profile null on 401, and exposes no profile error UI state.",
    "",
    "src/app/cart-provider.tsx - Active CartProvider that wraps children with a CartContext. It waits for StoreProvider and AuthProvider readiness, chooses mode 'guest' when profile is null and 'user' when profile exists, exposes cart/items/totalItems/isLoading/mode/addItem/updateItemQuantity/removeItem/clearCart/getItemQuantity, uses localStorage key store_cart for guest, uses apiClient cart APIs for user, updates UI before user API calls, ignores user API responses/failures, and never shows persistence failure toast.",
    "",
    "src/app/cart-selection.ts - Jotai atom `selectedCartItemIdsAtom` storing string[] selected cart item ids only. Do NOT store full item snapshots.",
    "",
    "src/data/sample-store.ts - sampleStore constant matching StoreDetail shape ({ id, slug, name, description }) used as fallback when VITE_STORE_SLUG is missing.",
    "",
    "src/components/ui/input.tsx - shadcn Input, h-10 rounded-md border px-3 py-2, focus-visible:ring-2",
    "",
    "src/components/ui/badge.tsx - shadcn Badge with cva, variants: default/secondary/destructive/outline/sale(amber-600), rounded-full",
    "",
    "src/components/ui/separator.tsx - shadcn Separator using @radix-ui/react-separator",
    "",
    "src/components/ui/label.tsx - shadcn Label using @radix-ui/react-label",
    "",
    "src/components/ui/select.tsx - shadcn Select using @radix-ui/react-select with SelectTrigger/SelectContent/SelectItem/SelectValue",
    "",
    "src/components/ui/radio-group.tsx - shadcn RadioGroup using @radix-ui/react-radio-group with RadioGroupItem",
    "",
    "src/components/ui/dialog.tsx - shadcn Dialog modal using @radix-ui/react-dialog with DialogTrigger/DialogContent/DialogHeader/DialogTitle/DialogDescription/DialogClose",
    "",
    "src/components/ui/sheet.tsx - shadcn-style bottom Sheet using vaul Drawer with Sheet/SheetTrigger/SheetContent/SheetHeader/SheetTitle/SheetClose; bottom-anchored (fixed inset-x-0 bottom-0), rounded-t-2xl, slide-up animation, with a small grab-handle bar at the top of SheetContent. Use ONLY for mobile bottom-sheet UX (the product-detail mobile model picker).",
    "",
    "src/components/ui/sonner.tsx - Toaster wrapper using sonner; checkout uses toast.success after createOrder",
    "",
    "src/components/layout/theme-toggle.tsx - ThemeToggle: import { Moon, Sun } from 'lucide-react', Button from @/components/ui/button. useState for light|dark, useEffect reads document.documentElement.classList on mount, toggle stores localStorage key 'storefront-theme' and document.documentElement.classList.toggle('dark'). Default theme is light unless the user explicitly toggled dark. Render outline icon Button between header search and cart; aria-label 'Toggle color theme'.",
    "",
    "src/components/layout/site-header.tsx - Retail header. Import { ThemeToggle } from '@/components/layout/theme-toggle'. Destructure `const { storeDetail } = useStore()` and `const { totalItems } = useCart()` at the top, then render brand name as <Link to='/'>{storeDetail?.name}</Link> on the left (StoreProvider gives storeDetail from GET /api/v1/stores/:storeSlug when VITE_STORE_SLUG is set, and sampleStore otherwise; do NOT use websiteConfig.store.name, do NOT call useStoreDetail() directly here, do NOT hardcode the brand string), a search bar in the middle, <ThemeToggle /> before the cart button, and a ShoppingCart icon Button on the right linking to /cart. Show a cart badge only when totalItems > 0. Derive storeId from storeDetail?.id (NOT from useStoreDetail().data?.id). NO Home/Products/Orders nav links. NO mobile Sheet menu. sticky top-0 border-b. Search-bar accent colors MUST bind to the DESIGN.md primary token (lighter tint of primary for input fill, soft primary tint for the focus ring, primary for the submit button background, primary for match highlight) — do NOT hardcode rose/pink. Pill input: rounded-full, h-11, pl-5 pr-1.5 py-2.5, focus:outline-none focus:ring-2 with the primary-tinted ring, no border. Leading Lucide Search icon h-4 w-4 with a muted primary tint. Input class 'text-sm text-slate-700 placeholder:text-slate-400'; placeholder MUST be exactly 'What are you looking for?'. Trailing inset circular submit Button (type='submit', size='icon', h-9 w-9 rounded-full bg-primary hover:bg-primary/90 text-white) containing a white Lucide Search icon h-4 w-4. Submit (form onSubmit OR Enter) calls useNavigate() from @tanstack/react-router and navigate({ to: '/products', search: { q: value.trim() } }) when value is non-empty, then closes the dropdown. Debounce the suggestions input value by 800ms via a useEffect+setTimeout — track BOTH the raw input value (for the input field, dropdown visibility gating, and form submit) AND a debouncedValue (passed as the query to useProductSuggestions) so users can type freely without firing a request per keystroke. Suggestions dropdown renders below the input (absolute, w-full, mt-2) when the input is focused AND inputValue.trim().length > 0 AND suggestions.length > 0, with class 'rounded-2xl bg-white p-3 shadow-lg shadow-black/5' (no hard border). Inside: 'Suggestions' label (text-xs font-medium text-slate-400 mb-1) then suggestion rows ('flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer' with a primary-tinted hover background) each with a leading Lucide Search icon h-4 w-4 text-slate-400 and the suggestion text (text-sm text-slate-700). Clicking a row sets the input value to the suggestion, navigates to /products with search { q: suggestion }, and closes the dropdown. Highlight matched substrings of the current input value against each suggestion (case-insensitive) by escaping regex metacharacters in the query, splitting via new RegExp('(' + escaped + ')', 'gi'), and wrapping matched parts with <span className='text-primary'> — same weight, no background. Accessibility: input role='combobox' with aria-expanded and aria-controls='site-search-suggestions'; dropdown role='listbox' id='site-search-suggestions'; rows role='option' aria-selected. Keyboard: ArrowDown/ArrowUp move active row, Enter selects active row (or submits typed value when no row is active), Escape closes. Hide dropdown on outside click and on isError from the suggestions hook. Wire suggestions via useProductSuggestions({ storeId, query: debouncedValue }) — do NOT branch on hasStoreSlug here, the hook handles the fallback internally.",
    "SiteHeader search suggestions MUST use the canonical state model: inputValue controls the input; debouncedValue is passed to useProductSuggestions; open closes only on outside click, Escape, submit, or suggestion click; showDropdown = open && inputValue.trim().length > 0 && suggestions.length > 0 && !isError. Render suggestions.map directly inside #site-search-suggestions. Do NOT hide the dropdown just because debouncedValue differs from inputValue or a new request is loading. Suggestion rows MUST use onMouseDown(event.preventDefault()) so blur cannot close the list before selection. Never make network suggestions without visible dropdown UI.",
    "SiteHeader MUST derive `const storeId = storeDetail?.id` from `const { storeDetail } = useStore()` and pass useProductSuggestions({ storeId, query: debouncedValue }); do NOT call useStoreDetail() inside SiteHeader.",
    "",
    "src/services/store/use-product-suggestions.ts - useProductSuggestions({ storeId, query }) hook. When VITE_STORE_SLUG exists AND storeId truthy AND query.trim().length > 0, call GET /api/v1/products/suggestions from the client runtime only with params { storeId, query } via @tanstack/react-query useQuery and apiClient.get<ProductSuggestionsList>('/api/v1/products/suggestions', { params }); response shape ProductSuggestionsList = { total: number, data: string[] }. queryKey ['product-suggestions', storeId, query.trim()]; enabled = hasStoreSlug && Boolean(storeId) && query.trim().length > 0; `isClientRuntime && ...` is allowed as a defensive guard when useful. When VITE_STORE_SLUG is missing OR query is empty, return a deterministic local sample list (filter product names from @/data/products by case-insensitive substring against query, dedupe, cap at 8) — mirror the sample-fallback pattern used by useProductsList. The hook returns { suggestions: string[], total: number, isLoading: boolean, isError: boolean, error: unknown, refetch: () => unknown }. Export ProductSuggestionsList type.",
    "",
    "src/components/layout/site-footer.tsx - CREATE (not pre-seeded). Footer with Shop/Support/Company/Connect columns; colors from DESIGN.md deep/deep-foreground tokens. For social/contact links, do NOT import brand icons from lucide-react (Instagram, Facebook, Twitter/X, LinkedIn, YouTube, TikTok, etc.); use generic icons known to exist such as Mail, MessageCircle, Send, Globe, ExternalLink, MapPin, Phone, or text labels. __root.tsx should import <SiteFooter />.",
    "",
    "src/components/layout/route-loading-bar.tsx - PRE-SEEDED. Optional: patch only if needed. __root.tsx imports <RouteLoadingBar /> before SiteHeader.",
    "",
    "Store sections (hero, product-card, product-grid, category-section, trust-signals, cart-item, order-card, feature-band, newsletter-section, etc.) — CREATE under src/components/store/ as the taste skill and DESIGN.md require. They are not pre-seeded.",
    "",
    "src/components/store/not-found.tsx - PRE-SEEDED. Optional: patch with DESIGN.md tokens and CTAs to '/' and '/products'. __root.tsx wires notFoundComponent to NotFound.",
    "",
    "src/routes/__root.tsx - createRootRoute with component Root and notFoundComponent wired to NotFound, html/head(HeadContent)/body(Providers wrapping StoreProvider wrapping AuthProvider wrapping CartProvider wrapping RouteLoadingBar/SiteHeader/Suspense(Outlet)/SiteFooter/Toaster, then Scripts). The first import MUST be the exact side-effect import `import '@vitejs/plugin-react/preamble'`, followed immediately by `import '@/styles/app.css'`, before React, TanStack Router, provider, component, or any other imports. This order is mandatory to prevent unstyled first paint during StoreProvider loading. NEVER write `@vitejs/plugin-react/preamble` as a bare line, never omit quotes, never import it as a binding, and NEVER import '../app.css', './app.css', or any relative CSS path. The TanStack Start `<Scripts />` tag is mandatory for client hydration; render it inside `<body>` after Providers and never omit, rename, conditionally render, or move it outside `<body>`. Wrap <Outlet /> in <Suspense fallback={<RouteSuspenseFallback />}> with a DESIGN.md-aligned skeleton fallback to prevent blank/broken client UI during route/component suspension. Keep SiteFooter and Toaster outside the Suspense-wrapped Outlet. NEVER remove Providers, notFoundComponent, RouteLoadingBar, AuthProvider, CartProvider, or place StoreProvider outside Providers; StoreProvider uses React Query and MUST always be inside QueryClientProvider via Providers.",
    "",
    "COMMERCE ROUTES (THIN SHELLS pre-seeded — expand with write/edit; do NOT delete): src/routes/index.tsx, src/routes/products/route.tsx, src/routes/products/index.tsx (validateSearch q/sort/category + hooks), src/routes/products/$productId.tsx, src/routes/cart.tsx, src/routes/checkout.tsx (validateSearch method), src/routes/orders/index.tsx, src/routes/orders/$orderId.tsx. Replace placeholders with full retail UX per taste skill + DESIGN.md.",
    "",

    "",
    "BEFORE CREATING FILES — REQUIRED RULES TO PREVENT ERRORS:",
    "",
    "1. NO TOP-LEVEL JSX: Every .tsx file MUST wrap ALL JSX inside a function/component. No JSX expressions at module top-level. Route files created with createFileRoute MUST place all JSX inside the route component function, never at file scope.",
    "",
    "2. COMPLETE IMPORTS: Every file MUST explicitly import every React hook (useState, useEffect, useRef, useMemo, useCallback), every component (Link, Button, etc.), every UI primitive from @/components/ui/*, and every type it uses. Do not rely on implicit globals or auto-imports. The Agent MUST NOT assume any name is available without an explicit import statement.",
    "",
    "3. DOMPurify SSR GUARD: DOMPurify.sanitize() calls window internally and WILL crash in SSR (Node.js). Wrap EVERY sanitize call: `typeof window !== 'undefined' ? DOMPurify.sanitize(html) : escapeHtml(html)`. Define escapeHtml inline as `const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;')` or import from @/lib/utils if available. NEVER call DOMPurify.sanitize unconditionally at module scope or inside a component without the typeof window guard. Product `descriptions` fields are HTML strings: always sanitize with DOMPurify + SSR guard, memoize with useMemo, render sanitized descriptions via dangerouslySetInnerHTML on a <div>, and never render `{product.descriptions}` as raw JSX text.",
    "",
    "4. OPTIONAL SEARCH PARAMS: All validateSearch fields in createFileRoute MUST be optional with sensible defaults. Use inline coercion with fallback (e.g., `typeof search.q === \'string\' ? search.q.trim() : \'\'`, `Number(search.page) || 1`). Never declare a search param as required when it maps to a URL query string. Every validateSearch field must have a default value so the route works with zero query params.",
    "",
    "5. AXIOS .data UNWRAP: When using `apiClient.get<T>(url, { params })`, the response is `AxiosResponse<T>`. The queryFn inside useQuery/useInfiniteQuery MUST return `response.data` (the unwrapped payload of type T), NOT the full AxiosResponse. The hook consumer then reads `query.data` which will be the unwrapped T. Example correct pattern: `queryFn: async () => { const res = await apiClient.get<T>(url); return res.data; }`.",
    "",
    "6. POST-GENERATION VALIDATION (MANDATORY): After creating ALL files with project_create_file, call `project_run_validation` with `level: \'fast\'` and `reason: \'typecheck generated storefront files\'`. Fix every error with project_apply_patch before declaring the task complete. If validation fails: inspect the error, apply the minimal fix, re-run validation. Repeat until validation passes. NEVER skip validation or leave errors unaddressed.",
    "",
    "NOW START: create DESIGN.md only if it is missing, then create missing required files using project_create_file. For PRE-SEEDED files, use write/edit only when customization is needed.",
  ].join("\n");
}
