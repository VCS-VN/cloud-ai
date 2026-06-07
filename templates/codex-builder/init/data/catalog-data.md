---
layer: CATALOG_DATA
warning: >
  Catalog sample data và hợp đồng hiển thị sản phẩm. Gửi nguyên văn tới model.
  Bỏ qua layer này → agent có thể rewrite data hoặc bỏ qua product grid.
---
CATALOG DATA (PRE-SEEDED — mandatory display):

- `src/data/products.ts` and `src/data/categories.ts` are already written by the Builder from the website spec before the agent loop. Do NOT recreate them with apply_patch and do NOT rewrite them unless the user explicitly asks.
- Routes and store components MUST NOT import `@/data/products` or `@/data/categories` directly. Always consume catalog through hooks (`useProductsList`, `useProductDetail`, `useCategoriesList`) per the data contract.
- Before finishing init, the storefront MUST show a real product catalog:
  - Create `src/components/store/product-card.tsx` and `src/components/store/product-grid.tsx` (recommended), or keep an inline grid in routes if minimal.
  - Home (`src/routes/index.tsx`) and `/products` MUST render products via `useProductsList({ storeId })` with loading and empty states.
  - Product detail MUST use `useProductDetail(productId)` for PDP content.
- Follow store-runtime infinite-scroll patterns when expanding the products page beyond the seed grid.

CUSTOMER-FACING COPY (hard rule):

- Every string in `src/routes/**` and `src/components/**` is shopper-facing copy.
- Never show builder/agent jargon in UI: no "taste skill", "route shell", "thin shell", "design taste", debug `Shell — q=…`, or "Build … using the design …" placeholders.
- Write retail-neutral text (product names, prices, empty states, loading messages) only.
