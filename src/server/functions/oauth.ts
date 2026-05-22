import { createServerFn } from '@tanstack/react-start'
import {
  createOAuthState,
  createOAuthTempSessionData,
  createPkcePair,
} from '@/auth/oauth-utils'

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
