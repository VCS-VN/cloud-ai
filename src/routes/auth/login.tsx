import { createFileRoute, redirect } from '@tanstack/react-router'
import { buildOAuthAuthorizeUrl } from '@/auth/oauth-client.server'
import { createOAuthTempSession } from '@/auth/oauth-temp-session.server'
import { getCurrentRequestCallbackUri } from '@/auth/request-origin.server'
import { createOAuthState, createOAuthTempSessionData, createPkcePair } from '@/auth/oauth-utils'

export const Route = createFileRoute('/auth/login')({
  loader: async () => {
    const state = createOAuthState()

    const { codeVerifier, codeChallenge } = await createPkcePair()

    await createOAuthTempSession(
      createOAuthTempSessionData(state, codeVerifier),
    )

    throw redirect({
      href: buildOAuthAuthorizeUrl({
        state,
        codeChallenge,
        redirectUri: getCurrentRequestCallbackUri(),
      }),
    })
  },
  component: LoginRoute,
})

function LoginRoute() {
  return null
}
