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
