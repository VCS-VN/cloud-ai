Storefront commerce routes and components must use store service hooks, not direct `@/data/products` or `@/data/categories` imports.
StoreProvider must preserve the VITE_STORE_SLUG real-store contract: use `useStoreDetail`, keep `hasStoreSlug`, and render StorefrontLoadingScreen as an icon-led loading UI rather than skeleton placeholders, placeholder cards, gray bars/boxes, or simulated storefront layout.

{{violations}}
