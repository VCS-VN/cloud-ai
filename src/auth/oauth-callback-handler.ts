import type { LoginResult, OAuthCallbackQuery, OAuthTempSessionData } from './types'

export type OAuthCallbackDependencies = {
  clearTempSession: () => Promise<void>
  readTempSession: () => Promise<OAuthTempSessionData | null>
  signInWithOAuthCode: (input: {
    code: string
    state: string
    codeVerifier: string
    redirectUri: string
  }) => Promise<LoginResult>
  getCloudAiOrigin: () => string
  getOauthRedirectUri: () => string
}

export type OAuthCallbackOutcome = {
  redirectHref: string
}

function buildHomeErrorRedirect(origin: string, error: string) {
  return `${origin}/?error=${encodeURIComponent(error)}`
}

export async function handleOAuthCallback(
  query: OAuthCallbackQuery,
  dependencies: OAuthCallbackDependencies
): Promise<OAuthCallbackOutcome> {
  if (query.error) {
    await dependencies.clearTempSession()
    return { redirectHref: buildHomeErrorRedirect(dependencies.getCloudAiOrigin(), query.error) }
  }

  if (!query.code || !query.state) {
    await dependencies.clearTempSession()
    return { redirectHref: buildHomeErrorRedirect(dependencies.getCloudAiOrigin(), 'missingOAuthCallbackParams') }
  }

  const temp = await dependencies.readTempSession()
  if (!temp || temp.state !== query.state) {
    await dependencies.clearTempSession()
    return { redirectHref: buildHomeErrorRedirect(dependencies.getCloudAiOrigin(), 'stateMismatch') }
  }

  const result = await dependencies.signInWithOAuthCode({
    code: query.code,
    state: query.state,
    codeVerifier: temp.codeVerifier,
    redirectUri: dependencies.getOauthRedirectUri()
  })

  await dependencies.clearTempSession()

  if (!result.ok) {
    return { redirectHref: buildHomeErrorRedirect(dependencies.getCloudAiOrigin(), result.code) }
  }

  return { redirectHref: `${dependencies.getCloudAiOrigin()}${result.redirectTo}` }
}
