export type StoreRuntimePromptInput = {
  selectedStoreSlug?: string | null;
};

export type StoreRuntimePromptContext =
  | {
    selectedStoreSlug: string;
    generatedEnv: {
      name: "VITE_STORE_SLUG";
      value: string;
      scope: "Builder app process owned; read-only for AI Agent";
    };
    storeRuntimeContract: {
      realDataEnabledBy: "import.meta.env.VITE_STORE_SLUG";
      queryStateLibrary: "useQuery";
      mockFallbackWhenSlugMissing: true;
      demoFallbackWhenSlugPresentAndStoreDetailFails: false;
    };
  }
  | {
    selectedStoreSlug: null;
    generatedEnv: {
      name: "VITE_STORE_SLUG";
      action: "do not add fake or blank value";
    };
    storeRuntimeContract: {
      mockFallbackWhenSlugMissing: true;
    };
  };

export function normalizeStoreSlug(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function buildStoreRuntimePromptContext(
  input: StoreRuntimePromptInput,
): StoreRuntimePromptContext {
  const slug = normalizeStoreSlug(input.selectedStoreSlug);
  if (slug) {
    return {
      selectedStoreSlug: slug,
      generatedEnv: {
        name: "VITE_STORE_SLUG",
        value: slug,
        scope: "Builder app process owned; read-only for AI Agent",
      },
      storeRuntimeContract: {
        realDataEnabledBy: "import.meta.env.VITE_STORE_SLUG",
        queryStateLibrary: "useQuery",
        mockFallbackWhenSlugMissing: true,
        demoFallbackWhenSlugPresentAndStoreDetailFails: false,
      },
    };
  }

  return {
    selectedStoreSlug: null,
    generatedEnv: {
      name: "VITE_STORE_SLUG",
      action: "do not add fake or blank value",
    },
    storeRuntimeContract: {
      mockFallbackWhenSlugMissing: true,
    },
  };
}

export type StoreRuntimeInstructionMode = "init" | "edit";

export function buildStoreRuntimeInstructions(input: {
  selectedStoreSlug?: string | null;
  mode?: StoreRuntimeInstructionMode;
}): string {
  const slug = normalizeStoreSlug(input.selectedStoreSlug);
  const mode: StoreRuntimeInstructionMode = input.mode ?? "edit";
  const lines: string[] = [];

  lines.push("Store Runtime Contract:");
  lines.push(
    "- Source of truth for the current selected store slug is the Builder Project entity store slug field, never ProjectState.",
  );

  if (slug) {
    lines.push(`- Current selected store slug: ${slug}.`);
    lines.push(
      `- Builder app process owns generated project .env values and contents and should sync VITE_STORE_SLUG=${slug}; AI Agent must treat .env as inaccessible and must not add or update it.`,
    );
  } else {
    lines.push(
      "- Selected store slug is missing. Do not invent, hardcode, or add a fake or blank VITE_STORE_SLUG.",
    );
  }

  lines.push(
    "- AI Agent must never read, create, edit, patch, delete, or rename generated project .env files (.env, .env.local, .env.production, .env.development, or .env.*). If the user asks for env changes, refuse and explain the Builder app process owns project env. .env.example may be updated only as sample documentation when directly relevant.",
  );
  lines.push(
    "- Generated storefront API requests MUST always go through `apiClient` from `@/services/http/client`. NEVER use native `fetch` for customer/store API requests. Store hooks MUST import `import { apiClient } from '@/services/http/client'` and call `apiClient.get(...)` with `params`; do not use URLSearchParams, response.json(), or fetch('/api/...').",
  );
  lines.push(
    "- Cart/profile API requests MUST also use the existing shared `apiClient` from `@/services/http/client`; never create a second axios instance and never use native fetch for auth/profile or cart calls.",
  );
  lines.push(
    "- Generated storefront code MUST handle store detail, products list, product detail, and categories list state via useQuery from @tanstack/react-query. Each list/detail hook returns real API data when VITE_STORE_SLUG exists and a sample fallback (resolved internally) when it is missing.",
  );
  lines.push("- Required generated store data functions and contracts:");
  lines.push("  - GET /api/v1/stores/:storeSlug for store detail.");
  lines.push(
    "  - GET /api/v1/products with query params limit (default 12), page (1-indexed), storeId, query for products list. Response shape: { total, data: Product[] } and MUST stay compatible with the existing sample ProductsList contract. Generated useProductsList MUST use useInfiniteQuery from @tanstack/react-query with getNextPageParam returning the next 1-indexed page only when (sum of items.length across all loaded pages) < lastPage.total; otherwise return undefined to signal end of list. The hook returns { products: Product[] (flattened across pages via pages.flatMap(p => p.data)), total, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error, refetch }. Sample fallback when VITE_STORE_SLUG is missing returns the full sample list with hasNextPage=false so consumers do not need to branch.",
  );
  lines.push(
    "  - GET /api/v1/products/:productId for product detail with default query params isGettingModels=true and isGettingDefaultModel=true. Response carries defaultModel and models[] alongside the base Product fields.",
  );
  lines.push(
    "  - GET /api/v1/categories with query param storeId for categories list. Response shape is CategoriesList { total, data: Category[] } where Category is { id, name, storeId? }.",
  );
  lines.push(
    "  - GET /api/v1/products/suggestions with query params storeId and query for product name suggestions. Response shape: ProductSuggestionsList { total: number, data: string[] }. Generated useProductSuggestions({ storeId, query }) MUST use useQuery from @tanstack/react-query and apiClient.get<ProductSuggestionsList>('/api/v1/products/suggestions', { params }) with queryKey ['product-suggestions', storeId, query.trim()] and enabled = hasStoreSlug && Boolean(storeId) && query.trim().length > 0. The hook returns { suggestions: string[], total, isLoading, isError, error, refetch }. Sample fallback when VITE_STORE_SLUG is missing OR query is empty returns a deterministic case-insensitive substring match of product names from @/data/products against query, deduped and capped at 8.",
  );
  lines.push(
    "  - GET /api/v1/auth/profile for shopper profile. Response shape: { id: string, phoneNumber?: string, email?: string, firstName?: string, lastName?: string }. AuthProvider MUST use useQuery, set user mode only when profile exists, expose { profile, isLoading, isAuthenticated, logout }, clear auth tokens and profile on logout, and on 401 clear auth tokens, set profile null, expose no error, and continue guest cart mode.",
  );
  lines.push(
    "  - Cart APIs: GET /api/v1/carts params { page: 1, limit: 100, storeId }; POST /api/v1/carts body { id: selectedModel.id, quantity }; PATCH /api/v1/carts/${id} body { quantity }; DELETE /api/v1/carts/${id}; DELETE /api/v1/carts/all params { storeId }; POST /api/v1/carts/items/bulk body { items: [{ itemId: selectedModel.id, quantity }] }. Cart item id is selected model id.",
  );
  lines.push(
    "- Generated cart runtime MUST use provider order Providers -> StoreProvider -> AuthProvider -> CartProvider. CartProvider waits for StoreProvider and AuthProvider to settle. Guest mode uses fixed localStorage key `store_cart` with shape { data: [{ store, items }], total, totalItems }. User mode loads cart page 1 limit 100. If guest cart has items when profile becomes available, bulk merge then load account cart and clear guest storage; if no guest items, skip merge.",
  );
  lines.push(
    "- Generated CartProvider MUST expose { cart, items, totalItems, isLoading, mode, addItem, updateItemQuantity, removeItem, clearCart, getItemQuantity }. Adding same selected model combines quantity. Updating existing item sets quantity, not add-more. Quantity 0 removes item and user mode calls DELETE /api/v1/carts/${id}. User mode updates UI before API persistence, ignores mutation responses, does not rollback, and does not show persistence failure toast.",
  );
  lines.push(
    "- Product detail is the only generated surface allowed to mutate cart. Product cards must link to product detail for option selection and must not add cart items.",
  );
  lines.push(
    "- Generated cart page MUST use useCart() and selectedCartItemIdsAtom. Default selection is empty. Each item has a checkbox. Top Select all toggles all visible items. Summary counts/totals selected ids only. Checkout is disabled when no items are selected and navigates to /checkout with search { method: 'cart' }. Checkout derives selected item details from selected ids plus current cart state; do not store full item snapshots.",
  );
  lines.push(
    "- Do not invent additional store API endpoints, query params, or response schemas beyond the five listed contracts.",
  );
  lines.push(
    "- When VITE_STORE_SLUG is missing, generated StoreProvider MUST return the sampleStore constant from @/data/sample-store instead of calling /api/v1/stores/:storeSlug. The sample fallback for products, product detail, categories, and product suggestions is encapsulated inside useProductsList, useProductDetail, useCategoriesList, and useProductSuggestions — components and routes consume those hooks unconditionally and do NOT branch on hasStoreSlug to swap data sources.",
  );
  lines.push(
    "- When VITE_STORE_SLUG exists, generated StoreProvider MUST block app rendering with a full-page loading skeleton while useStoreDetail is loading, and show a store load error UI with retry on error. Do not render sample fallback during this loading/error phase.",
  );
  lines.push(
    "- Generated src/routes/__root.tsx MUST import '@vitejs/plugin-react/preamble' first, then import '@/styles/app.css'. NEVER import '../app.css', './app.css', or any relative CSS path. It MUST import Providers from @/app/providers and render exactly this provider order inside <body>: <Providers><StoreProvider><AuthProvider><CartProvider><RouteLoadingBar /><SiteHeader /><Suspense fallback={<RouteSuspenseFallback />}><Outlet /></Suspense><SiteFooter /><Toaster /></CartProvider></AuthProvider></StoreProvider></Providers><Scripts />. RouteLoadingBar MUST render before SiteHeader. SiteFooter and Toaster MUST stay outside the Suspense-wrapped Outlet. RouteSuspenseFallback MUST be a DESIGN.md-aligned skeleton to prevent blank/broken client UI during route/component suspension. NEVER remove Providers, AuthProvider, CartProvider, RouteLoadingBar, NEVER place StoreProvider outside Providers, and NEVER call React Query hooks before QueryClientProvider is mounted.",
  );
  lines.push(
    "- When VITE_STORE_SLUG exists and store detail, products list, product detail, categories list, or product suggestions loading fails, generated code MUST show a load error UI with a retry/refetch button for that screen, render a loading skeleton during the pending state, and MUST NOT silently fall back to demo store, @/data/products, or @/data/categories sample values. The hook-encapsulated sample path never errors, so error UI only appears when hasStoreSlug is true. SiteHeader suggestions are non-critical: on isError, hide the dropdown rather than render an error UI.",
  );
  lines.push(
    "- Any generated route or component that consumes useProductsList MUST handle productsQuery.isLoading with a product-grid skeleton, productsQuery.isError with a products load error UI and retry/refetch button, and isFetchingNextPage with a loading-more indicator. This applies to pages and reusable components such as ProductGrid; never render an empty list while the query is pending.",
  );
  lines.push(
    "- Any generated route or component that consumes useProductDetail MUST handle isLoading with a product-detail skeleton and isError or missing product data with a product load error UI and retry/refetch button before reading product fields. This applies to pages and reusable product detail components.",
  );
  lines.push(
    "- Generated storefront UI MUST follow DESIGN.md tokens for loading, empty, error, and retry states.",
  );
  lines.push(
    "- Generated route and component code (src/routes/products/index.tsx, src/components/store/product-grid.tsx, src/routes/products/$productId.tsx, src/components/store/category-section.tsx, src/components/layout/site-header.tsx) MUST consume useProductsList, useProductDetail, useCategoriesList, and useProductSuggestions from @/services/store and MUST NOT import { products } from @/data/products or { categories } from @/data/categories. Import the Product type from @/services/store/use-products-list and the Category type from @/services/store/use-categories-list when needed. The hook implementations themselves under @/services/store/* MAY import from @/data/products and @/data/categories internally to build their sample fallbacks (mirroring the existing pattern in useProductsList).",
  );
  lines.push(
    "- Generated route and component code that reads query/provider/API data MUST use optional chaining and nullish fallbacks for nested or nullable values before rendering or computing values. Examples: storeDetail?.setting?.currency ?? 'AUD', product?.category?.name, product?.images?.[0], product?.models?.length. Direct property access is allowed only after an explicit loading/error/missing-data guard proves the value exists in that branch.",
  );
  lines.push(
    "- The Product type stores the long-form product copy in the `descriptions` field (plural). The legacy singular `description` field is removed from Product/ProductDetail in @/services/store/use-products-list and @/services/store/use-product-detail. Sample data and generated UI MUST read product.descriptions; never read product.description.",
  );
  lines.push(
    "- The Product.category field is an object `{ id: string; name: string }`. The legacy `category?: string` shape is removed. Generated UI MUST read `product.category?.name` for display (e.g. eyebrow text above the product name) and MUST NOT render `product.category` directly — that is an object and React will throw at runtime.",
  );
  lines.push(
    "- Generated src/routes/products/$productId.tsx MUST render the following sections: (1) IMAGE GALLERY — compute images = product.images ?? (product.image ? [product.image] : []); track active index via useState<number>(0); main image is images[selectedImageIndex] ?? images[0] ?? product.image; thumbnail strip hidden when images.length <= 1. (2) MODEL SELECTOR + PRICE — useState<ProductModel | undefined>(undefined) for selectedModel, but DO NOT preselect defaultModel or models[0]. Display price is selectedModel?.price ?? product.defaultModel?.price ?? resolveProductPrice(product) ?? 0. Desktop chips active state uses selectedModel.id only. User MUST explicitly select a model before add/update cart is enabled. (3) DESCRIPTIONS / READ-MORE — read product.descriptions, sanitize with DOMPurify and SSR guard, render through dangerouslySetInnerHTML on a div, and never read product.description. (4) QUANTITY + TOTAL + CART ACTION — use getItemQuantity(selectedModel.id) from useCart to show current cart quantity for the selected model; if item exists, action label is Update cart and updateItemQuantity sets quantity; if not, action label is Add to cart and addItem({ product, model: selectedModel, quantity }) creates the cart item. Quantity 0 removes the item. Buttons disabled until selectedModel.id exists. (5) MOBILE BOTTOM SHEET — mobile trigger may open before selection so shoppers can choose a model, but confirm button is disabled until selectedModel.id exists. NEVER render mobile sheet trigger at md+ breakpoints, NEVER render desktop chips below md. Add pb-28 md:pb-12 to the page main.",
  );
  lines.push(
    "- Generated route and component code MUST derive storeId from `const { storeDetail } = useStore()` and pass storeDetail?.id into useProductsList, useCategoriesList, and useProductSuggestions; do not call useStoreDetail() directly in routes/components and do not re-read import.meta.env.VITE_STORE_SLUG inside route or component code.",
  );
  lines.push(
    "- Generated product list UIs (home ProductGrid in src/components/store/product-grid.tsx and the /products route in src/routes/products/index.tsx) MUST implement infinite scroll: render an IntersectionObserver-watched sentinel <div ref={loadMoreRef} /> at the end of the product grid, and call fetchNextPage() when the sentinel intersects the viewport AND hasNextPage AND !isFetchingNextPage. Show a small inline 'Loading more...' indicator inside the sentinel while isFetchingNextPage is true. Initial loading skeleton (isLoading) and error UI with retry (isError, refetch) remain unchanged. Total product count text MUST read from the hook's total field, not products.length.",
  );
  lines.push(
    "- Generated src/components/layout/site-header.tsx MUST import { ThemeToggle } from '@/components/layout/theme-toggle' (seeded at project init). Render a search-bar header (NO Home/Products/Orders nav links, NO mobile Sheet menu): brand name on the left rendered as {storeDetail?.name} where storeDetail comes from `const { storeDetail } = useStore()` (StoreProvider resolves storeDetail from GET /api/v1/stores/:storeSlug when VITE_STORE_SLUG exists, else from sampleStore — do NOT use websiteConfig.store.name here, do NOT call useStoreDetail() directly inside SiteHeader, and do NOT hardcode the brand string), a search-pill input in the middle, <ThemeToggle /> before the cart button, and a ShoppingCart icon Button on the right linking to /cart. It MUST read totalItems from useCart() and show a badge only when totalItems > 0. Search-bar accent colors MUST bind to the project's DESIGN.md primary token (use the primary color's lighter tint for input fill, a soft primary tint for the focus ring, primary for the submit button background, and primary for the match-highlight text); do NOT hardcode rose/pink. Pill input: rounded-full, h-11, pl-5 pr-1.5 py-2.5, focus:outline-none focus:ring-2 with the primary-tinted ring, no border. Leading Lucide Search icon h-4 w-4 with a muted primary tint. Input class 'text-sm text-slate-700 placeholder:text-slate-400'; placeholder MUST be exactly 'What are you looking for?'. Trailing inset circular submit Button (type='submit', size='icon', h-9 w-9 rounded-full, bg-primary hover:bg-primary/90, text-white) containing a white Lucide Search icon h-4 w-4.",
  );
  lines.push(
    "- SiteHeader MUST derive `const storeId = storeDetail?.id` from `const { storeDetail } = useStore()` and consume useProductSuggestions({ storeId, query: debouncedValue }) where debouncedValue is the raw input value debounced by 800ms via a useEffect+setTimeout (track BOTH the raw input value and the debouncedValue separately — the raw value drives the input field, dropdown visibility gating, and form submit; the debouncedValue is the query passed to the suggestions hook). Render the suggestions dropdown below the input (absolute, w-full, mt-2) when the input is focused AND inputValue.trim().length > 0 AND suggestions.length > 0. Dropdown class 'rounded-2xl bg-white p-3 shadow-lg shadow-black/5' (no hard border). Header label 'Suggestions' (text-xs font-medium text-slate-400 mb-1). Each row: 'flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer' with a primary-tinted hover background, a leading Lucide Search icon h-4 w-4 text-slate-400, and the suggestion text (text-sm text-slate-700). No dividers between rows.",
  );
  lines.push(
    "- SiteHeader search suggestions MUST use this exact state contract: inputValue controls the input; debouncedValue goes to useProductSuggestions; open closes only on outside click, Escape, submit, or suggestion click; showDropdown = open && inputValue.trim().length > 0 && suggestions.length > 0 && !isError. Render suggestions.map directly inside #site-search-suggestions. Do NOT hide suggestions while debouncedValue differs from inputValue or while the next request is loading. Suggestion rows MUST use onMouseDown(event.preventDefault()) so input blur cannot close the dropdown before row selection.",
  );
  lines.push(
    "- SiteHeader MUST derive `const storeId = storeDetail?.id` from `const { storeDetail } = useStore()` and pass useProductSuggestions({ storeId, query: debouncedValue }); do NOT call useStoreDetail() inside SiteHeader.",
  );
  lines.push(
    "- SiteHeader form submit AND suggestion-row click MUST call useNavigate() from @tanstack/react-router and navigate({ to: '/products', search: { q: value.trim() } }) when value is non-empty, then close the dropdown. The /products route MUST declare validateSearch on createFileRoute to coerce ?q to a trimmed string defaulting to '', read it via Route.useSearch(), and pass it as the query argument to useProductsList({ storeId, query }) so the search query becomes part of the queryKey and useInfiniteQuery resets to page 1 naturally when q changes.",
  );
  lines.push(
    "- SiteHeader MUST highlight matches between the current input value and each suggestion (case-insensitive). Implement a small inline helper that escapes regex metacharacters in the query, splits the suggestion using new RegExp('(' + escaped + ')', 'gi'), and wraps the matched parts with <span className='text-primary'> — same weight, no background. Non-matched parts render as plain text.",
  );
  lines.push(
    "- SiteHeader keyboard behaviour: ArrowDown/ArrowUp moves the active suggestion row, Enter selects the active row (or submits the typed value when no row is active), Escape closes the dropdown. Accessibility: input has role='combobox' with aria-expanded and aria-controls='site-search-suggestions'; the dropdown list has id='site-search-suggestions' role='listbox'; rows have role='option' and aria-selected. Hide the dropdown on outside click and on isError from the suggestions hook.",
  );
  lines.push(
    "- Generated ProductCard MUST wrap the product title text node with a TanStack Router <Link to='/products/$productId' params={{ productId: product.id }}> — the product image renders as a bare <img> (or fallback gradient div) WITHOUT being wrapped by the Link.",
  );
  lines.push(
    "- Generated ProductCard MUST render product.descriptions (when displayed in the card preview) as DOMPurify-sanitized HTML: `import DOMPurify from 'dompurify'`, memoize the sanitize call with `useMemo` keyed on product.descriptions, and render through `dangerouslySetInnerHTML={{ __html: sanitized }}` on a wrapping <div> (NOT a <p>) with the existing `line-clamp-2` truncation preserved. NEVER render product.descriptions raw without DOMPurify.sanitize.",
  );
  lines.push(
    "- Brand and store name displayed anywhere in generated JSX/text (site header logo, site footer brand block, hero eyebrow, page titles, meta tags, share copy) MUST be rendered as {storeDetail?.name} where storeDetail comes from a single destructured call `const { storeDetail } = useStore()` near the top of the component (StoreProvider resolves storeDetail from GET /api/v1/stores/:storeSlug when VITE_STORE_SLUG is set, and to sampleStore otherwise — consumers do NOT branch on hasStoreSlug, do NOT call useStoreDetail() directly in routes/components, and do NOT call useStore().storeDetail?.name inline). Use websiteConfig.store.name from @/lib/website-config only for chrome rendered outside StoreProvider. NEVER hardcode literal brand strings such as 'AI Storefront', 'AI Store front', 'Demo Store', or any other placeholder name in generated code. websiteConfig is sample/static data; live brand identity always flows through the useStore() hook.",
  );
  lines.push(
    "- StoreDetail.setting.currency is the ISO 4217 currency code from the API; default to 'AUD' when missing. The sample fallback store also exposes setting.currency='AUD' so the slug-missing path renders consistently.",
  );
  lines.push(
    "- Product price values throughout the response (product.price, product.compareAtPrice, product.defaultModel.price, product.models[].price) are integer cents. State, hooks, and sample data preserve cents — division by 100 happens only at render time inside @/lib/format-money. Components MUST NOT pre-divide before passing to formatMoney.",
  );
  lines.push(
    "- Generated price-rendering code MUST use resolveProductPrice(product) from @/lib/format-money — which falls back through defaultModel.price → models[0].price → price via _.get — and MUST pass { currency: useStore().storeDetail?.setting?.currency ?? 'AUD' } to formatMoney. Lodash is CommonJS in the generated app: NEVER use named imports from 'lodash'. Use `import lodash from 'lodash'` and call `lodash.get`, `lodash.divide`, and `lodash.round` in price helpers.",
  );
  lines.push(
    "- Generated product visuals MUST render product.image ?? product.images?.[0] via <img> with object-cover when set, with the existing gradient <div> kept only as a fallback when neither field is present.",
  );

  if (mode === "edit") {
    lines.push(
      "- Preserve existing VITE_STORE_SLUG and real store data loading behavior during unrelated edits. Do not replace real data with hardcoded sample products or categories when VITE_STORE_SLUG exists.",
    );
    lines.push(
      "- Remove the store runtime contract only when the user explicitly requests removal.",
    );
  } else {
    lines.push(
      "- Initialize the four useQuery-managed store data functions during project init so they are present from first generation.",
    );
  }

  return lines.join("\n");
}
