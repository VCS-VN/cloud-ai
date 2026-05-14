import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentRequestCallbackUri, getCurrentRequestOrigin } from '@/auth/request-origin.server'
import { handleOAuthCallback } from '@/auth/oauth-callback.server'
import type { OAuthCallbackQuery } from '@/auth/types'
import { getRequestUrl } from '@tanstack/react-start/server'

export const Route = createFileRoute('/auth/callback')({
  beforeLoad: async ({ search }) => {
    const origin = getCurrentRequestOrigin()

    const result = await handleOAuthCallback(search as OAuthCallbackQuery, {
      origin,
      redirectUri: `${origin}/auth/callback`,
    })

    throw redirect({ href: result.redirectHref })
  },
  component: CallbackRoute,
})

function CallbackRoute() {
  return null
}
