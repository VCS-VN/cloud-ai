import type { Message } from '@/shared/project-types'

const MAX_HISTORY_TURNS = 12
const MAX_HISTORY_CHAR_BUDGET = 8000

export const SHARED_SAMPLE_DATA_FILE_PATHS = [
  "src/providers/store-provider.tsx",
  "src/data/sample-store.ts",
] as const

type PromptHistoryMessage = Pick<Message, 'role' | 'content'>

function dedupeConsecutiveMessages(history: PromptHistoryMessage[]) {
  return history.reduce<PromptHistoryMessage[]>((messages, message) => {
    const previousMessage = messages[messages.length - 1]
    if (
      previousMessage &&
      previousMessage.role === message.role &&
      previousMessage.content === message.content
    ) {
      return messages
    }

    messages.push(message)
    return messages
  }, [])
}

function trimToRecentTurns(history: PromptHistoryMessage[]) {
  let userTurnCount = 0
  const selected: PromptHistoryMessage[] = []

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    selected.push(message)

    if (message.role === 'user') {
      userTurnCount += 1
      if (userTurnCount >= MAX_HISTORY_TURNS) break
    }
  }

  return selected.reverse()
}

function trimToCharacterBudget(history: PromptHistoryMessage[]) {
  if (history.length <= 1) return history

  let totalCharacters = history.reduce(
    (sum, message) => sum + message.content.length,
    0,
  )

  if (totalCharacters <= MAX_HISTORY_CHAR_BUDGET) return history

  const trimmed = [...history]
  while (trimmed.length > 1 && totalCharacters > MAX_HISTORY_CHAR_BUDGET) {
    const removedMessage = trimmed.shift()
    totalCharacters -= removedMessage?.content.length ?? 0
  }

  return trimmed
}

export function buildProjectMessageInput({
  prompt,
  history,
}: {
  prompt: string
  history: Array<Pick<Message, 'role' | 'content'>>
}) {
  const trimmedPrompt = prompt.trim()

  const normalizedHistory = history
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content.length > 0)

  const dedupedHistory = dedupeConsecutiveMessages(normalizedHistory)
  const latestHistory =
    trimmedPrompt.length > 0 &&
    dedupedHistory[dedupedHistory.length - 1]?.role === 'user' &&
    dedupedHistory[dedupedHistory.length - 1]?.content === trimmedPrompt
      ? dedupedHistory
      : trimmedPrompt.length > 0
        ? dedupedHistory.concat({ role: 'user', content: trimmedPrompt })
        : dedupedHistory

  const recentTurns = trimToRecentTurns(latestHistory)
  return trimToCharacterBudget(recentTurns)
}


export function buildStoreSampleDataInstructions() {
  return [
    "After creating pages and components, initialize shared StoreProvider sample data.",
    "During project init, create generated project-detail .env with VITE_API_BASE_URL=https://customer-api.myepis.cloud, preserving any existing env values if the file already exists.",

    `Create and preserve shared sample data files: ${SHARED_SAMPLE_DATA_FILE_PATHS.join(", ")}.`,
    "Use the fixed Store, Product, and ProductsList structures for sample data and do not add, remove, rename, or reshape fields.",
    "Create one Store and one ProductsList with at least 6 realistic nail-studio Products.",
    "Expose Store and ProductsList through StoreProvider so generated pages and components consume shared store/product values instead of local placeholders.",
    "Generated pages/components must read Store and ProductsList from StoreProvider; do not duplicate independent store/product placeholder objects inside routes or components.",
    "When user prompts update sample data, change values or product list membership/order only; never change Store/Product/ProductsList structure.",
    "Match product updates by stable product id first. If product target, value, or reorder list is ambiguous, ask a clarification question before changing data.",
    "Keep ProductsList as { total, data }, keep total equal to data.length, and keep each product.entityId equal to product.id.",
    "When generated project-detail .env contains VITE_STORE_SLUG, generated route and component code MUST consume useProductsList, useProductDetail, and useCategoriesList from @/services/store. The sample fallback for products, product detail, and categories is encapsulated inside those hooks and resolves to @/data/products / @/data/categories when VITE_STORE_SLUG is missing.",
    "Routes and components MUST NOT import { products } from @/data/products or { categories } from @/data/categories. Always consume the hooks unconditionally.",
    "Derive storeId by calling useStoreDetail() and reading data?.id; pass that storeId into useProductsList and useCategoriesList so their enabled gate flips on once the store detail resolves.",
    "Do not re-read import.meta.env.VITE_STORE_SLUG inside route or component code and do not branch on hasStoreSlug to swap data sources — the hook handles that internally.",
    "For the Product type in generated code that consumes useProductsList or useProductDetail, import Product from @/services/store/use-products-list rather than from @/data/products.",
    "If VITE_STORE_SLUG exists and products list or product detail loading fails, show a loading skeleton during pending state and a load error UI with a retry/refetch button on error; the hook-encapsulated sample fallback path never errors, so error UI only appears when hasStoreSlug is true.",
    "Initialize five useQuery-managed store data functions during project init: store detail, products list, product detail, categories list, and product suggestions.",
    "Store detail must call GET /api/v1/stores/:storeSlug using import.meta.env.VITE_STORE_SLUG.",
    "Products list must call GET /api/v1/products with query params limit (default 12), page (1-indexed), storeId, query and preserve the existing ProductsList { total, data } response shape. Generated useProductsList MUST use useInfiniteQuery from @tanstack/react-query with getNextPageParam returning the next 1-indexed page only when (sum of items.length across all loaded pages) < lastPage.total; otherwise return undefined. The hook returns { products: Product[] flattened across pages, total, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error, refetch }. Sample fallback when VITE_STORE_SLUG is missing returns the full sample list with hasNextPage=false. Generated home ProductGrid and /products route MUST implement infinite scroll via an IntersectionObserver-watched sentinel that calls fetchNextPage() when intersecting AND hasNextPage AND !isFetchingNextPage. Product price fields (price, compareAtPrice, defaultModel.price, models[].price) are integer cents.",
    "Product detail must call GET /api/v1/products/:productId with default query params isGettingModel=true and isGettingDefaultModel=true. Response carries defaultModel and models[] alongside the base Product fields.",
    "Categories list must call GET /api/v1/categories with query param storeId; response shape is CategoriesList { total, data: Category[] } where Category is { id, name, storeId? }.",
    "Product suggestions must call GET /api/v1/products/suggestions with query params storeId and query; response shape is ProductSuggestionsList { total: number, data: string[] }. Generated useProductSuggestions({ storeId, query }) MUST use useQuery from @tanstack/react-query with queryKey ['product-suggestions', storeId, query.trim()] and enabled = hasStoreSlug && Boolean(storeId) && query.trim().length > 0. Returns { suggestions: string[], total, isLoading, isError, error, refetch }. Sample fallback when VITE_STORE_SLUG is missing OR query is empty returns a deterministic case-insensitive substring match of @/data/products names against query, deduped and capped at 8.",
    "All five queries must use enabled so server calls only run when VITE_STORE_SLUG exists and required IDs/inputs are available; the hook still returns deterministic sample fallback data to consumers when disabled.",
    "If VITE_STORE_SLUG exists and store detail loading fails, show a store-detail error UI with retry/refetch and do not silently fall back to demo store data.",
    "StoreDetail.setting.currency is the ISO 4217 currency code from the store API; default to 'AUD' when missing. The sample-fallback store also exposes setting.currency='AUD'.",
    "Product price values throughout state, hooks, and sample data are integer cents. Never pre-divide before rendering; @/lib/format-money divides by 100 internally at render time.",
    "Generated price-rendering code MUST use formatMoney(resolveProductPrice(product), { currency: useStore().storeDetail?.setting?.currency ?? 'AUD' }) from @/lib/format-money. resolveProductPrice falls back through defaultModel.price → models[0].price → price using lodash _.get. Use lodash (_.get, _.divide, _.round) for safe access and arithmetic in any new price helpers; the generated app has lodash installed.",
    "Generated src/components/layout/site-header.tsx MUST render a search-bar header (NO Home/Products/Orders nav links, NO mobile Sheet menu) with brand name on the left, a rounded-full search input (placeholder 'What are you looking for?') with a leading Lucide Search icon and a trailing inset circular submit Button, and a ShoppingCart icon Button on the right. Search-bar accent colors MUST bind to the DESIGN.md primary token; do NOT hardcode rose/pink. SiteHeader debounces the raw input value by 800ms via a useEffect+setTimeout and consumes useProductSuggestions({ storeId: useStoreDetail().data?.id, query: debouncedValue }) — the raw value drives the input field, dropdown visibility gating, and form submit; the debouncedValue is what the suggestions hook receives. Render a suggestions dropdown ('rounded-2xl bg-white p-3 shadow-lg shadow-black/5') below the input with a 'Suggestions' label and rows containing a leading Search icon and the suggestion text. Match highlighting is case-insensitive using <span className='text-primary'>. Submit and row click navigate to /products with search { q: value } via useNavigate() from @tanstack/react-router. The /products route declares validateSearch on createFileRoute, reads `q` via Route.useSearch(), and passes it as `query` to useProductsList.",
    "Generated product visuals MUST render product.image ?? product.images?.[0] inside an <img> with object-cover when set, with the existing gradient placeholder div kept only as a fallback when neither field is present.",
  ].join("\n")
}
