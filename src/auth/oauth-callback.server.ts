import '@tanstack/react-start/server-only'
import { getCloudAiOrigin, getOauthRedirectUri } from './oauth-config'
import { clearOAuthTempSession, readOAuthTempSession } from './oauth-temp-session.server'
import { getAuthService } from './auth-service'
import { handleOAuthCallback as handleOAuthCallbackWithDependencies } from './oauth-callback-handler'
import type { OAuthCallbackQuery } from './types'

export function handleOAuthCallback(
  query: OAuthCallbackQuery,
  options: { origin?: string; redirectUri?: string } = {}
) {
  return handleOAuthCallbackWithDependencies(query, {
    clearTempSession: clearOAuthTempSession,
    readTempSession: readOAuthTempSession,
    signInWithOAuthCode: (input) => getAuthService().signInWithOAuthCode(input),
    getCloudAiOrigin: () => options.origin ?? getCloudAiOrigin(),
    getOauthRedirectUri: () => options.redirectUri ?? getOauthRedirectUri()
  })
}
