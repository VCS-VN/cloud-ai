import { createFileRoute, redirect } from '@tanstack/react-router'
import { handleOAuthCallbackFn } from '@/server/functions/oauth'
import type { OAuthCallbackQuery } from '@/auth/types'

export const Route = createFileRoute('/auth/callback')({
  beforeLoad: async ({ search }) => {
    const result = await handleOAuthCallbackFn({ data: search as OAuthCallbackQuery })
    throw redirect({ href: result.redirectHref })
  },
  component: CallbackRoute,
})

function CallbackRoute() {
  return null
}
