Generated storefront API requests must use `apiClient` from `@/services/http/client`.
Do not use native `fetch`, `URLSearchParams`, `response.json()`, or hand-built `/api/...` URLs in generated store/customer API code.
Store/customer API must be client-side only. Prefer plain TanStack Query client execution with no loader/prefetch SSR. If there is any risk of SSR execution, gate with `isClientRuntime` / `typeof window !== 'undefined'` or configure TanStack Start selective SSR. Root route must render `<Scripts />`.

{{violations}}
