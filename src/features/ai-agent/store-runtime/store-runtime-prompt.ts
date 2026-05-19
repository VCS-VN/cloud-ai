export type StoreRuntimePromptInput = {
  selectedStoreSlug?: string | null;
};

export type StoreRuntimePromptContext =
  | {
      selectedStoreSlug: string;
      generatedEnv: {
        name: "VITE_STORE_SLUG";
        value: string;
        scope: "generated project-detail .env files only";
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
        scope: "generated project-detail .env files only",
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
      `- Generated project-detail .env MUST contain VITE_STORE_SLUG=${slug}. Add it when missing or update it when stale.`,
    );
  } else {
    lines.push(
      "- Selected store slug is missing. Do not invent, hardcode, or add a fake or blank VITE_STORE_SLUG.",
    );
  }

  lines.push(
    "- Env edits are allowed only inside generated project-detail .env files. Never edit repository-level or Builder application .env or secret files.",
  );
  lines.push("- Preserve unrelated environment variables when adding or updating VITE_STORE_SLUG.");
  lines.push(
    "- Generated storefront code MUST handle store detail, products list, product detail, and categories list state via useQuery from @tanstack/react-query. Each list/detail hook returns real API data when VITE_STORE_SLUG exists and a sample fallback (resolved internally) when it is missing.",
  );
  lines.push("- Required generated store data functions and contracts:");
  lines.push("  - GET /api/v1/stores/:storeSlug for store detail.");
  lines.push(
    "  - GET /api/v1/products with query params limit (default 12), page (1-indexed), storeId, query for products list. Response shape: { total, data: Product[] } and MUST stay compatible with the existing sample ProductsList contract. Generated useProductsList MUST use useInfiniteQuery from @tanstack/react-query with getNextPageParam returning the next 1-indexed page only when (sum of items.length across all loaded pages) < lastPage.total; otherwise return undefined to signal end of list. The hook returns { products: Product[] (flattened across pages via pages.flatMap(p => p.data)), total, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error, refetch }. Sample fallback when VITE_STORE_SLUG is missing returns the full sample list with hasNextPage=false so consumers do not need to branch.",
  );
  lines.push(
    "  - GET /api/v1/products/:productId for product detail with default query params isGettingModel=true and isGettingDefaultModel=true. Response carries defaultModel and models[] alongside the base Product fields.",
  );
  lines.push(
    "  - GET /api/v1/categories with query param storeId for categories list. Response shape is CategoriesList { total, data: Category[] } where Category is { id, name, storeId? }.",
  );
  lines.push(
    "  - GET /api/v1/products/suggestions with query params storeId and query for product name suggestions. Response shape: ProductSuggestionsList { total: number, data: string[] }. Generated useProductSuggestions({ storeId, query }) MUST use useQuery from @tanstack/react-query with queryKey ['product-suggestions', storeId, query.trim()] and enabled = hasStoreSlug && Boolean(storeId) && query.trim().length > 0. The hook returns { suggestions: string[], total, isLoading, isError, error, refetch }. Sample fallback when VITE_STORE_SLUG is missing OR query is empty returns a deterministic case-insensitive substring match of product names from @/data/products against query, deduped and capped at 8.",
  );
  lines.push(
    "- Do not invent additional store API endpoints, query params, or response schemas beyond the five listed contracts.",
  );
  lines.push(
    "- When VITE_STORE_SLUG is missing, generated StoreProvider MUST return the sampleStore constant from @/data/sample-store instead of calling /api/v1/stores/:storeSlug. The sample fallback for products, product detail, categories, and product suggestions is encapsulated inside useProductsList, useProductDetail, useCategoriesList, and useProductSuggestions — components and routes consume those hooks unconditionally and do NOT branch on hasStoreSlug to swap data sources.",
  );
  lines.push(
    "- When VITE_STORE_SLUG exists and store detail, products list, product detail, categories list, or product suggestions loading fails, generated code MUST show a load error UI with a retry/refetch button for that screen, render a loading skeleton during the pending state, and MUST NOT silently fall back to demo store, @/data/products, or @/data/categories sample values. The hook-encapsulated sample path never errors, so error UI only appears when hasStoreSlug is true. SiteHeader suggestions are non-critical: on isError, hide the dropdown rather than render an error UI.",
  );
  lines.push(
    "- Generated storefront UI MUST follow DESIGN.md tokens for loading, empty, error, and retry states.",
  );
  lines.push(
    "- Generated route and component code (src/routes/products/index.tsx, src/components/store/product-grid.tsx, src/routes/products/$productId.tsx, src/components/store/category-section.tsx, src/components/layout/site-header.tsx) MUST consume useProductsList, useProductDetail, useCategoriesList, and useProductSuggestions from @/services/store and MUST NOT import { products } from @/data/products or { categories } from @/data/categories. Import the Product type from @/services/store/use-products-list and the Category type from @/services/store/use-categories-list when needed. The hook implementations themselves under @/services/store/* MAY import from @/data/products and @/data/categories internally to build their sample fallbacks (mirroring the existing pattern in useProductsList).",
  );
  lines.push(
    "- Generated route and component code MUST derive storeId from useStoreDetail().data?.id and pass it into useProductsList and useCategoriesList; do not re-read import.meta.env.VITE_STORE_SLUG inside route or component code.",
  );
  lines.push(
    "- Generated product list UIs (home ProductGrid in src/components/store/product-grid.tsx and the /products route in src/routes/products/index.tsx) MUST implement infinite scroll: render an IntersectionObserver-watched sentinel <div ref={loadMoreRef} /> at the end of the product grid, and call fetchNextPage() when the sentinel intersects the viewport AND hasNextPage AND !isFetchingNextPage. Show a small inline 'Loading more...' indicator inside the sentinel while isFetchingNextPage is true. Initial loading skeleton (isLoading) and error UI with retry (isError, refetch) remain unchanged. Total product count text MUST read from the hook's total field, not products.length.",
  );
  lines.push(
    "- Generated src/components/layout/site-header.tsx MUST render a search-bar header (NO Home/Products/Orders nav links, NO mobile Sheet menu): brand name on the left, a search-pill input in the middle, and a ShoppingCart icon Button on the right. Search-bar accent colors MUST bind to the project's DESIGN.md primary token (use the primary color's lighter tint for input fill, a soft primary tint for the focus ring, primary for the submit button background, and primary for the match-highlight text); do NOT hardcode rose/pink. Pill input: rounded-full, h-11, pl-5 pr-1.5 py-2.5, focus:outline-none focus:ring-2 with the primary-tinted ring, no border. Leading Lucide Search icon h-4 w-4 with a muted primary tint. Input class 'text-sm text-slate-700 placeholder:text-slate-400'; placeholder MUST be exactly 'What are you looking for?'. Trailing inset circular submit Button (type='submit', size='icon', h-9 w-9 rounded-full, bg-primary hover:bg-primary/90, text-white) containing a white Lucide Search icon h-4 w-4.",
  );
  lines.push(
    "- SiteHeader MUST consume useProductSuggestions({ storeId: useStoreDetail().data?.id, query: debouncedValue }) where debouncedValue is the raw input value debounced by 800ms via a useEffect+setTimeout (track BOTH the raw input value and the debouncedValue separately — the raw value drives the input field, dropdown visibility gating, and form submit; the debouncedValue is the query passed to the suggestions hook). Render the suggestions dropdown below the input (absolute, w-full, mt-2) when the input is focused AND inputValue.trim().length > 0 AND suggestions.length > 0. Dropdown class 'rounded-2xl bg-white p-3 shadow-lg shadow-black/5' (no hard border). Header label 'Suggestions' (text-xs font-medium text-slate-400 mb-1). Each row: 'flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer' with a primary-tinted hover background, a leading Lucide Search icon h-4 w-4 text-slate-400, and the suggestion text (text-sm text-slate-700). No dividers between rows.",
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
    "- Brand and store name displayed anywhere in generated JSX/text (site header logo, site footer brand block, hero eyebrow, page titles, meta tags, share copy) MUST be sourced from websiteConfig.store.name (from @/lib/website-config) or useStore().storeDetail?.name (when inside StoreProvider). NEVER hardcode literal brand strings such as 'AI Storefront', 'AI Store front', 'Demo Store', or any other placeholder name in generated code.",
  );
  lines.push(
    "- StoreDetail.setting.currency is the ISO 4217 currency code from the API; default to 'AUD' when missing. The sample fallback store also exposes setting.currency='AUD' so the slug-missing path renders consistently.",
  );
  lines.push(
    "- Product price values throughout the response (product.price, product.compareAtPrice, product.defaultModel.price, product.models[].price) are integer cents. State, hooks, and sample data preserve cents — division by 100 happens only at render time inside @/lib/format-money. Components MUST NOT pre-divide before passing to formatMoney.",
  );
  lines.push(
    "- Generated price-rendering code MUST use resolveProductPrice(product) from @/lib/format-money — which falls back through defaultModel.price → models[0].price → price via _.get — and MUST pass { currency: useStore().storeDetail?.setting?.currency ?? 'AUD' } to formatMoney. Use lodash (_.get, _.divide, _.round) for safe access and arithmetic in price helpers; the generated app has lodash installed.",
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
