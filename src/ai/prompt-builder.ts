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
    "When generated project-detail .env contains VITE_STORE_SLUG, generated code must enable real server data through useQuery; when VITE_STORE_SLUG is missing, keep using these sample mocked Store and ProductsList values.",
    "Initialize four useQuery-managed store data functions during project init: store detail, products list, product detail, and categories list.",
    "Store detail must call GET /api/v1/stores/:storeSlug using import.meta.env.VITE_STORE_SLUG.",
    "Products list must call GET /api/v1/products with query params limit, page, storeId, query and preserve the existing ProductsList { total, data } response shape.",
    "Product detail must call GET /api/v1/products/:productId with default query params isGettingModel=true and isGettingDefaultModel=true.",
    "Categories list must call GET /api/v1/categories with query param storeId.",
    "All four queries must use enabled so server calls only run when VITE_STORE_SLUG exists and required IDs are available.",
    "If VITE_STORE_SLUG exists and store detail loading fails, show a store-detail error UI with retry/refetch and do not silently fall back to demo store data.",
  ].join("\n")
}
