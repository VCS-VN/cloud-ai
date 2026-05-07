import type { Message } from '@/shared/project-types'

const MAX_HISTORY_TURNS = 12
const MAX_HISTORY_CHAR_BUDGET = 8000

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
