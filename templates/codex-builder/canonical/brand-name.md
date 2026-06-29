---
rule: canonical-brand-name
---
BRAND NAME RENDERING:
- Single source of truth: `const { storeDetail } = useStore()` destructured once near the top of the component. Render the brand/store name everywhere as `{storeDetail?.name}`.
- StoreProvider resolves storeDetail from `GET /api/v1/stores/:storeSlug` when `VITE_STORE_SLUG` is set, and from `sampleStore` (`@/data/sample-store`) otherwise. Consumers MUST NOT branch on `hasStoreSlug`, call `useStoreDetail()` directly in routes/components, or use inline `useStore().storeDetail?.name` expressions.
- `websiteConfig.store.name` is sample/static data — use it ONLY for chrome rendered outside `<StoreProvider>`. Live brand identity always flows through `useStore()`.
- NEVER hardcode placeholder brand strings in JSX, headings, eyebrows, footers, page titles, or meta tags: forbidden examples include "AI Storefront", "AI Store front", "Demo Store", "My Store", "Your Store", or any literal that is not derived from `storeDetail`.
