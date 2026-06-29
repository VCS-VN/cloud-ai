---
rule: canonical-data-shape
---
STOREFRONT DATA SHAPES (canonical):

Product (consumed by hooks + routes + components):
```ts
type Product = {
  id: string;              // slug
  name: string;
  descriptions?: string;   // HTML string (rich-text). Plural: NEVER `description`. Required in sample data, optional in API
  image?: string;
  images?: string[];
  category?: { id: string; name: string };
  price?: number;          // INTEGER CENTS (1899 = $18.99). Never decimals.
  compareAtPrice?: number; // cents
  defaultModel?: ProductModel;
  models?: ProductModel[];
};
type ProductModel = { id: string; name: string; price: number /* cents */ };
type ProductsList = { total: number; data: Product[] };
type ProductDetail = Product;
type ProductSuggestionsList = { total: number; data: string[] };
```

Category:
```ts
type Category = { id: string; name: string; storeId?: string };
type CategoriesList = { total: number; data: Category[] };
```

Store:
```ts
type StoreDetail = { id: string; name: string; slug?: string; setting?: StoreSetting };
type StoreSetting = { currency?: string };  // ISO 4217, default fallback 'AUD'
```

Cart (state exposed by `useCart()`):
```ts
{
  cart: { data: [{ store, items }]; total; totalItems };
  items;
  totalItems;
  isLoading;
  mode: 'guest' | 'user';
  addItem(payload: { product, model, quantity });
  updateItemQuantity(id: string, quantity: number);
  removeItem(id: string);
  clearCart();
  getItemQuantity(id: string): number;
}
```
- Cart payload to `addItem` MUST be built explicitly: `const payload = { product, model: selectedModel, quantity }`.
- Cart user-mode API: `POST /api/v1/carts` (add), `PATCH /api/v1/carts/${id}` (update qty), `DELETE /api/v1/carts/${id}` (remove), `DELETE /api/v1/carts/all` params `{ storeId }` (clear), `POST /api/v1/carts/items/bulk` (merge on auth transition).

DESCRIPTIONS RENDERING (hard rule):
- `product.descriptions` is an HTML string. Sanitize before rendering: `import DOMPurify from 'dompurify'`, then `const sanitizedDescriptions = useMemo(() => { const html = product.descriptions ?? ''; return typeof window !== 'undefined' ? DOMPurify.sanitize(html) : escapeHtml(html); }, [product.descriptions])`. Render via `dangerouslySetInnerHTML={{ __html: sanitizedDescriptions }}` on a wrapping `<div>` (NOT `<p>` — HTML may contain block-level tags like `<ul>`).
- `escapeHtml` inline helper: `const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')`.
- The `typeof window !== 'undefined'` SSR guard is REQUIRED — DOMPurify accesses `window` and crashes during SSR.
- NEVER render `{product.descriptions}` as raw JSX text. NEVER pass unsanitized strings to `dangerouslySetInnerHTML`.

PRICE FORMATTING:
- Prices live as integer cents everywhere — state, hooks, sample data, API. Never pre-divide.
- Render price ONLY via `formatMoney(resolveProductPrice(product), { currency })` where `currency = useStore().storeDetail?.setting?.currency ?? 'AUD'`.
- `resolveProductPrice` falls back: `defaultModel.price → models[0].price → price` using `lodash.get`.
- `formatMoney` divides cents by 100 internally with `lodash.divide` and rounds with `lodash.round` before `Intl.NumberFormat`. Components MUST NOT call `formatMoney(product.price)` directly.
- Lodash is CommonJS in the generated app: `import lodash from 'lodash'`, then `lodash.get(...)`, `lodash.divide(...)`, `lodash.round(...)`. NEVER use named imports from `'lodash'`.

DIRECT DATA IMPORTS (forbidden in UI):
- Routes (`src/routes/**`) and storefront components (`src/components/**`) MUST NOT import `@/data/products`, `@/data/categories`, or `@/data/sample-store`. Always consume via the hooks: `useProductsList`, `useProductDetail`, `useCategoriesList`, `useProductSuggestions`, `useStore`.
- ONLY the hook implementations under `src/services/store/*` import these data files (for their sample-fallback path).
