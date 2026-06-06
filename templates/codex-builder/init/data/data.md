---
layer: DATA
warning: >
  Hợp đồng cho data-layer hook. Gửi nguyên văn tới model. Sửa sai → hook gọi
  sai endpoint hoặc sai shape response.
---
CREATE THIS DATA HOOK:

src/services/store/use-product-suggestions.ts - useProductSuggestions({ storeId, query }) hook. When VITE_STORE_SLUG exists AND storeId truthy AND query.trim().length > 0, call GET /api/v1/products/suggestions from the client runtime only with params { storeId, query } via @tanstack/react-query useQuery and apiClient.get<ProductSuggestionsList>('/api/v1/products/suggestions', { params }); response shape ProductSuggestionsList = { total: number, data: string[] }. queryKey ['product-suggestions', storeId, query.trim()]; enabled = hasStoreSlug && Boolean(storeId) && query.trim().length > 0; `isClientRuntime && ...` is allowed as a defensive guard when useful. When VITE_STORE_SLUG is missing OR query is empty, return a deterministic local sample list (filter product names from @/data/products by case-insensitive substring against query, dedupe, cap at 8) — mirror the sample-fallback pattern used by useProductsList. The hook returns { suggestions: string[], total: number, isLoading: boolean, isError: boolean, error: unknown, refetch: () => unknown }. Export ProductSuggestionsList type.
