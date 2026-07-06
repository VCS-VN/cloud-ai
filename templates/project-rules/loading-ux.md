---
rule: loading-ux
---
# Entry Loading UX Rules

- The storefront must show a branded full-screen entry loading overlay or splash when a user first opens the website.
- The entry loading state covers first paint and fades out smoothly once the app is ready, including fonts/CSS loaded and StoreProvider settled.
- Apply the entry loading state consistently whether `VITE_STORE_SLUG` is present or absent.
- The loading gate MUST NOT be conditioned on `VITE_STORE_SLUG`/`hasStoreSlug` alone. It MUST also cover the initial client-mount/hydration window (e.g. a `mounted` flag set in a mount `useEffect`) so first-load loading is visible even when sample data resolves synchronously with no slug. Gate as `if (!mounted || (hasStoreSlug && isLoading)) return <StorefrontLoadingScreen />;`.
- StoreProvider loading MUST be implemented in StorefrontLoadingScreen as icon-led, not skeleton-led: use a clear commerce/store icon treatment (for example a Lucide Store, ShoppingBag, or LoaderCircle icon), visible motion/state, and accessible loading text.
- Use DESIGN.md tokens and semantic utilities such as `bg-background`, `bg-deep`, `text-foreground`, and animation colors from the storefront palette.
- Do not use skeleton placeholders, a Skeleton component, animate-pulse placeholders, gray bars/boxes, simulated header/product-card grids, placeholder cards, a bare spinner, empty text, or a generic unbranded loading screen for StorefrontLoadingScreen.
- Do not use fake timers to hold the loading state. Depend only on real readiness signals.
- Loading must not cause layout shift and must not block forever if data loading fails; fade out and let the existing error UI render.
- Do not replace or remove `RouteLoadingBar` or `RouteSuspenseFallback`. The entry splash is only for app startup; route loading and suspense fallbacks handle navigation and suspended route content.
- Generated storefronts default to light theme on first load, matching the UI design rule.
