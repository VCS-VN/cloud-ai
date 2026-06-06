---
layer: PRODUCTS_PAGE
warning: >
  Route danh sách sản phẩm. Spec hành vi (infinite scroll, search param, hooks).
  Gửi nguyên văn tới model.
---
src/routes/products/index.tsx - THIN SHELL pre-seeded (createFileRoute('/products/'), validateSearch for q/sort/category, hooks wired). Expand into a full catalog page: title, category filters, sort, product grid (create product-card + grid components), infinite scroll via useProductsList fetchNextPage, loading/error/empty states. Use `const { storeDetail } = useStore()`, useProductsList({ storeId, query: q }), useCategoriesList(storeId). Do NOT import from @/data/* in the route. Pass Route.useSearch() q to useProductsList; reset pages when q changes.