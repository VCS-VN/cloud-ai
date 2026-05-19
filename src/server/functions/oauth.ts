import { createServerFn } from '@tanstack/react-start'
import {
  createOAuthState,
  createOAuthTempSessionData,
  createPkcePair,
} from '@/auth/oauth-utils'
import type { OAuthCallbackQuery } from '@/auth/types'

export const handleOAuthCallbackFn = createServerFn({ method: 'POST' })
  .inputValidator((data: OAuthCallbackQuery) => data)
  .handler(async ({ data }) => {
    const { handleOAuthCallback } = await import('@/auth/oauth-callback.server')
    const { getCurrentRequestOrigin } = await import('@/auth/request-origin.server')
    const origin = getCurrentRequestOrigin()
    return handleOAuthCallback(data, {
      origin,
      redirectUri: `${origin}/auth/callback`,
    })
  })

export const startOAuthLoginFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const { buildOAuthAuthorizeUrl } = await import('@/auth/oauth-client.server')
    const { createOAuthTempSession } = await import('@/auth/oauth-temp-session.server')
    const { getCurrentRequestCallbackUri } = await import('@/auth/request-origin.server')

    const state = createOAuthState()
    const { codeVerifier, codeChallenge } = await createPkcePair()
    await createOAuthTempSession(createOAuthTempSessionData(state, codeVerifier))

    return {
      href: buildOAuthAuthorizeUrl({
        state,
        codeChallenge,
        redirectUri: getCurrentRequestCallbackUri(),
      }),
    }
  },
)
