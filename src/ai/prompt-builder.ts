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
    `Create and preserve shared sample data files: ${SHARED_SAMPLE_DATA_FILE_PATHS.join(", ")}.`,
    "Use the fixed Store, Product, and ProductsList structures for sample data and do not add, remove, rename, or reshape fields.",
    "Create one Store and one ProductsList with at least 6 realistic nail-studio Products.",
    "Expose Store and ProductsList through StoreProvider so generated pages and components consume shared store/product values instead of local placeholders.",
    "Generated pages/components must read Store and ProductsList from StoreProvider; do not duplicate independent store/product placeholder objects inside routes or components.",
    "When user prompts update sample data, change values or product list membership/order only; never change Store/Product/ProductsList structure.",
    "Match product updates by stable product id first. If product target, value, or reorder list is ambiguous, ask a clarification question before changing data.",
    "Keep ProductsList as { total, data }, keep total equal to data.length, and keep each product.entityId equal to product.id.",
  ].join("\n")
}
