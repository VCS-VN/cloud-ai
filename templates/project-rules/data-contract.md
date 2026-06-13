---
rule: data-contract
---
# Storefront Data Contract

- Routes and storefront components should consume store service hooks from `@/services/store/*`.
- Product list UIs use `useProductsList`.
- Product detail pages use `useProductDetail`.
- Category UI uses `useCategoriesList`.
- Header search suggestions use `useProductSuggestions`.
- Routes and storefront components should not directly import `@/data/products` or `@/data/categories`.
- Sample data fallback belongs inside the service hooks, not in route/component UI logic.
- Live store identity should flow through `useStore()` from `@/app/store-provider`.
- Render store/brand name from `const { storeDetail } = useStore()` and `{storeDetail?.name}` rather than hardcoded placeholder names.
- Price rendering should use `formatMoney` and `resolveProductPrice`; product prices are integer cents.
- Generated routes/components must use safe nullable access for every value from query hooks, providers, route params, API payloads, and every data/entity object at every nested level. Prefer optional chaining on each level plus nullish fallbacks before rendering or computing values: `store?.name?.trim()`, `storeDetail?.setting?.currency ?? 'AUD'`, `product?.descriptions?.trim() ?? ''`, `product?.category?.name`, `product?.images?.[0]`, `product?.models?.[0]?.name`, `product?.models?.length ?? 0`, `order?.items ?? []`.
- Treat optional chaining as the default style for generated storefront data/entity reads, even when TypeScript currently marks a field as required, because live API payloads and partial query states can be incomplete. Direct nested property access is allowed only after an explicit guard in the same branch proves the parent value exists. Examples: after `if (!product) return <MissingProduct />`, `product.name` is allowed in the guarded branch; nullable children still use optional chaining/fallbacks such as `product.category?.name`, `product.descriptions?.trim() ?? ''`, and `(product.models ?? []).map(...)`.
- Before mapping arrays from API/query data, normalize with nullish fallback: `(products ?? []).map(...)`, `(product?.models ?? []).map(...)`, `(order?.items ?? []).map(...)`. Never call `.map`, `.filter`, `.reduce`, `.length`, or index access on maybe-undefined API fields without `?.` or `?? []`.
- Product detail pages must handle `isLoading`, `isError`, and missing `product` before reading product fields. Catalog/list pages must handle loading/error and default list arrays to `[]` so incomplete API data cannot crash the app.
