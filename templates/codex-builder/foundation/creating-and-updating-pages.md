---
prompt: creating-and-updating-pages
---
# Instruction — Creating & Updating Pages

> Guidelines for building and modifying pages in a generated storefront. Applies to **both creation and updates**: every change must follow the **Route**, **Form**, **API**, and **Data** rules below. Stack: React + TS + Vite + TanStack Router (start) + React Query + Jotai (cart selection only) + shadcn/ui. The per-page behavioral spec lives in `templates/codex-builder/init/pages/<page>.md` — read it first.

---

## 0. General principles (apply to every change)
- **Surgical changes**: touch only what you must. Don't refactor/reformat adjacent code, don't add abstractions for single-use code (per `AGENTS.md`).
- **Follow the page spec before coding**: the behavioral spec is `init/pages/<page>.md` (e.g. `init/pages/checkout.md`). If a change diverges from it, update that spec to match.
- **Honor the canonical rules**: `canonical/data-shape.md`, `canonical/cart-mutation.md`, `canonical/ui-tokens.md`, `canonical/brand-name.md` are authoritative. They win over anything here on conflict.
- **Don't break contracts**: keep API payload/response shapes, the money unit (integer cents), and field names unchanged unless explicitly asked.
- **Match existing style**: reuse existing hooks/components/utils instead of writing new duplicates.

---

## 1. Route rules

- Define via `createFileRoute("/<path>")`, rendering the page component.
- Layout chrome is rendered once in `src/routes/__root.tsx`: `SiteHeader` → `<Suspense>` `<Outlet/>` → `SiteFooter`, plus `RouteLoadingBar` and the sonner `Toaster`, all inside `<Providers>`. **Don't rebuild header/footer/loading bar/toaster** inside a page. There is no `RootLayout`/`StoreRouteWrapper`/`ErrorBoundary` wrapper and no `MobileBottomNav`/`FloatingCartButton` — don't reference them.
- Store data is loaded once by `StoreProvider`, which gates children behind `StorefrontLoadingScreen` until ready. Inside a page you may assume the store is present — read it with `const { storeDetail } = useStore()` (React Context), **not** a `storeAtom`.
- Checkout is reached only from the cart page with an explicit selection, navigated with `search: { method: 'cart' }` (see `canonical/cart-mutation.md`). Validate that search param in the route's `validateSearch`.
- Guards (auth/empty-cart) live **in the component**, not at route level.

---

## 2. FORM rules

The current `init/pages/checkout.md` checkout is a **placeholder skeleton**: an uncontrolled `<form onSubmit>` with `Input`/`Label` that fires `toast.success(...)` and does **not** persist an order. When you are asked to build out a real form, follow these rules; until then, do not invent order-submission logic the spec doesn't ask for.

1. **Empty inputs, placeholders only** (hard rule from `init/pages/checkout.md`):
   - Inputs MUST be empty by default; show example content via `placeholder` props only.
   - Do **NOT** seed `defaultValues` with fake customer data ("John Doe", phone numbers, emails, addresses, postcodes). Example values belong in placeholder text, never in the input value.
2. **Validation lives in a schema module**, not scattered `if` checks in JSX. If you introduce zod + react-hook-form, add the schema in its own file, export both the schema and its `z.infer` type, and keep error messages in the schema. (Note: no `schemas/` dir or `zodResolver` exists in the templates yet — you are adding it; wire it minimally.)
3. **AU market domain rules** for address/phone fields, when present:
   - phone: 10 digits, starting `0[23478]`.
   - country: literal `"AU"`; state enum `NSW/VIC/QLD/WA/SA/TAS/ACT/NT`.
   - postalCode min 4, suburb min 2, address line min 6.
   - Don't relax these without an explicit request.
4. **Field ↔ UI**:
   - Inputs/labels use shadcn `Input`/`Label`. For geographic selects use the shadcn `Select` (`src/components/ui/select.tsx`, Radix-based — it **does** exist) composed with semantic token classes per `canonical/ui-tokens.md`. There is no `form-select-shell` class; don't invent one.
   - Show each field's error inline near the field, using semantic destructive tokens.
   - On invalid submit, scroll+focus the first errored field.
5. **Submit guards** run before any network call: auth-loading → return; not signed in → open the login flow and return; empty required input → return; only then submit.
6. **Unsaved-data warning**: for a heavy/multi-step form, add a `beforeunload` handler while the form is dirty.

> When updating: adding a field → add it to schema + defaultValues (empty) + JSX + the focus-map together. Removing a field → remove it from all of them, leaving no orphans.

---

## 3. API rules

1. **Reads go through a React Query hook** under `src/services/store/`, named `use-<thing>.ts` (e.g. `use-products-list.ts`, `use-store-detail.ts`). There is **no** `services/*.service.ts` layer and no `toApiError` helper — don't reference either. Follow the existing hook shape.
2. **Use the shared `apiClient`** from `src/services/http/client.ts` (a single axios instance). `baseURL` comes from `import.meta.env.VITE_API_BASE_URL` at module load. Don't create a new axios instance and don't hardcode a base URL. (There is no default `timeout` configured; don't claim one.)
3. **Auth**: a request interceptor attaches `Authorization: Bearer <token>` from `localStorage.auth_token` automatically. **Don't set the auth header yourself.** (There is currently no 401/refresh response interceptor — don't assume automatic refresh.)
4. **Versioning**: all endpoints are `/api/v1/...`. There is no `/api/v2`. Match whatever version an endpoint already uses; don't invent new versions.
5. **Query keys are inline arrays** matching the existing hooks, e.g. `["store-detail", storeSlug]`, `["products-list", storeId, query]`. There is no `lib/query-keys.ts` / `queryKeys` object — don't reference one.
6. **React Query usage**:
   - `useQuery`/`useInfiniteQuery` for reads, with `enabled` gating so it only fetches when inputs are valid (e.g. suggestions need a store + non-empty query).
   - Cart **writes** are **not** React Query. The cart is `useState` + `localStorage` (guest) with raw `apiClient.post/patch/delete` in user mode (`src/app/cart-provider.tsx`). Don't introduce `useMutation` for the cart. There is no `invalidateQueries` in the codebase; don't add one.
   - If you add a query driven by fast-changing user input (e.g. a postcode field), debounce the input before it enters the key/`queryFn`.
7. **Shape payloads explicitly in the hook/handler, not in JSX.** Build cart payloads as `{ product, model: selectedModel, quantity }` (see `canonical/data-shape.md`). Send required fields even when empty; send optional fields only when they have a value.
8. **Third-party absolute-URL calls still pass through the auth interceptor** (the token is attached to every `apiClient` request). Flag this risk before adding one, or use a bare `axios`/`fetch` call for the third party so the token isn't leaked.

> When updating: changing/adding an endpoint → update the hook + its types + the inline query key + `enabled` together. Don't change a response shape the UI depends on before auditing every consumer.

---

## 4. DATA rules

1. **Money = integer cents** throughout state, hooks, sample data, and the API (`1899` = $18.99). Never pre-divide.
   - Render prices ONLY via `formatMoney(resolveProductPrice(product), { currency })` where `currency = useStore().storeDetail?.setting?.currency ?? 'AUD'`. `formatMoney(amountInCents, { currency, locale })` divides by 100 internally; its defaults are `currency="AUD"`, `locale="en-AU"`. There is no `formatCurrency` — don't call it. Components MUST NOT call `formatMoney(product.price)` directly (use `resolveProductPrice`).
2. **State sources**:
   - **Server reads** → React Query hooks under `src/services/store/*`.
   - **Store** → `useStore()` React Context. **Cart** → `useCart()` React Context (`src/app/cart-provider.tsx`).
   - **Shared cart selection** → the Jotai `selectedCartItemIdsAtom` (string ids only, default `[]`). This is the only Jotai atom; there is no `storeAtom` or `selectedCartItemsAtom`.
   - **Local UI state** → `useState`. **Derived data** → `useMemo` (don't store duplicates).
3. **Don't import data files in UI**: routes and storefront components MUST NOT import `@/data/*`. Consume via the hooks (`useProductsList`, `useProductDetail`, `useCategoriesList`, `useProductSuggestions`, `useStore`). Only the `src/services/store/*` hooks may import `@/data/*` for their sample-fallback path.
4. **`product.descriptions` is HTML** — sanitize with `DOMPurify` behind a `typeof window !== 'undefined'` guard before `dangerouslySetInnerHTML` on a `<div>`. Never render it as raw JSX text (see `canonical/data-shape.md`).
5. **Currency**: read the store currency (`storeDetail?.setting?.currency ?? 'AUD'`) and pass it explicitly to `formatMoney`. If you build order math that mixes a shipping quote in a different currency than the store, exclude the mismatched leg and surface a disclaimer rather than silently summing across currencies.
6. **UI states must be complete**: loading / empty / error for each async region.

---

## 5. UI Component rules
- **Reuse shadcn primitives** in `src/components/ui/*` (pre-seeded, runtime-owned — do NOT rewrite them). Available: `badge`, `button`, `card`, `dialog`, `input`, `label`, `radio-group`, `select`, `separator`, `sheet`, `sonner`. There is **no** `textarea` primitive — add one only if the task needs it. Compose with `variant`/`size` props + semantic token classes; don't override built-in variants with broad raw color classes (see `canonical/ui-tokens.md`).
- Overlay panels (dropdown/select/dialog/sheet) MUST use an opaque surface token (`bg-popover`/`bg-card`) with `border-border` and shadow — never `bg-transparent`, `backdrop-blur`, or `opacity-*` on the panel.
- Layout chrome (`SiteHeader`, `SiteFooter`, `RouteLoadingBar`, `Toaster`) is rendered by `__root.tsx`. Don't rebuild it.
- **Follow `DESIGN.md`** (the active theme is **"Figma"**: white canvas, black ink, `figmaSans` type, oversized pastel color blocks, `accent-magenta #ff3d8b`, pill CTAs). Use semantic token utilities (`bg-primary`, `text-foreground`, `border-border`) — don't hardcode hex colors outside the token system.
- Don't import brand/social icons from `lucide-react` (they may not exist and break the build); use generic icons (`Mail`, `Phone`, `MapPin`, `Globe`, …).

---

## 6. Checklist for creating a new page
```
1. Read init/pages/<page>.md (the behavioral spec) + relevant canonical/*.md
2. Create src/routes/<name>.tsx → createFileRoute, validateSearch if needed → verify: header/footer NOT rebuilt
3. Render loading / empty / error / main branches for each async region
4. (If a form) empty inputs + placeholders only; validation in a schema module; AU rules when address/phone
5. Reads via a src/services/store/use-*.ts React Query hook using apiClient; inline query key; enabled gating
6. Wire state: React Query (server) / useStore + useCart context / selectedCartItemIdsAtom (cart selection) / useState / useMemo
7. UI: shadcn primitives + DESIGN.md semantic tokens; no rebuilt chrome
8. Money in cents; render via formatMoney(resolveProductPrice(p), { currency })
9. Verify: pnpm build/typecheck clean; golden path + edge cases (empty cart, logged out, API error)
```

## 7. Checklist for updating a page
```
1. Read init/pages/<page>.md + canonical/*.md before editing
2. Adding/editing a form field → sync schema + empty defaultValues + JSX + focus-map (never seed fake data)
3. Keep AU domain rules (phone/state/postal) unless explicitly asked to change them
4. Changing an API → update the use-*.ts hook + its types + inline query key + enabled; audit every consumer
5. Keep the cents unit + formatMoney/resolveProductPrice usage
6. Don't introduce useMutation/invalidateQueries for the cart — it's useState + localStorage + raw apiClient
7. Deleting code → clean up orphans YOU created; don't remove pre-existing dead code unless asked
8. Update init/pages/<page>.md if behavior changes
9. Verify: build/typecheck + run the golden path & regression-check nearby areas
```

---

## 8. Anti-patterns (avoid)
- Seeding `defaultValues` with fake customer data instead of using placeholders.
- Referencing things that don't exist in the templates: `services/*.service.ts`, `toApiError`, `/api/v2`, `lib/query-keys.ts`, `storeAtom`, `formatCurrency`, `form-select-shell`, `RootLayout`, `MobileBottomNav`, `FloatingCartButton`.
- Validating with scattered `if` checks in the component instead of a schema module.
- Creating a new axios instance or hardcoding a base URL instead of the shared `apiClient`.
- Setting the `Authorization` header yourself (the interceptor does it).
- Adding `useMutation`/`invalidateQueries` for the cart, or mixing cache styles.
- Money math in dollars — always cents until display via `formatMoney`/`resolveProductPrice`.
- Skipping `enabled`/debounce → redundant or invalid-input fetches.
- Stuffing server data into Jotai, or storing duplicate derived state instead of `useMemo`.
- Rendering `product.descriptions` unsanitized.
- Rebuilding header/footer/loading/toaster that `__root.tsx` already provides.
