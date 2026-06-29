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
- Product detail pages must handle `isLoading`, `isError`, and missing `product` before reading product fields. Catalog/list pages must handle loading/error and default list arrays to `[]` so incomplete API data cannot crash the app.

{{include:canonical/brand-name.md}}

{{include:canonical/safe-access.md}}

{{include:canonical/data-shape.md}}
