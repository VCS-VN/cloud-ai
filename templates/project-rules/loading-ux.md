---
rule: loading-ux
---
# Entry Loading UX Rules

- The storefront must show a branded full-screen entry loading overlay or splash when a user first opens the website.
- The entry loading state covers first paint and fades out smoothly once the app is ready, including fonts/CSS loaded and StoreProvider settled.
- Apply the entry loading state consistently whether `VITE_STORE_SLUG` is present or absent.
- Use DESIGN.md tokens and semantic utilities such as `bg-background`, `bg-deep`, `text-foreground`, and animation colors from the storefront palette.
- Do not use a bare spinner, empty text, gray box, or generic unbranded loading screen.
- Do not use fake timers to hold the loading state. Depend only on real readiness signals.
- Loading must not cause layout shift and must not block forever if data loading fails; fade out and let the existing error UI render.
- Do not replace or remove `RouteLoadingBar` or `RouteSuspenseFallback`. The entry splash is only for app startup; route loading and suspense fallbacks handle navigation and suspended route content.
- Generated storefronts default to light theme on first load, matching the UI design rule.
