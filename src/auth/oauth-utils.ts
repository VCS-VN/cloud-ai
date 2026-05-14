import type { OAuthTempSessionData } from './types'

function base64UrlEncode(bytes: ArrayBuffer) {
  return Buffer.from(bytes).toString('base64url')
}

export function createOAuthState() {
  return crypto.randomUUID()
}

export async function createPkcePair() {
  const codeVerifier = crypto.randomUUID() + crypto.randomUUID()
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  const codeChallenge = base64UrlEncode(digest)
  return { codeVerifier, codeChallenge }
}

export function createOAuthTempSessionData(state: string, codeVerifier: string): OAuthTempSessionData {
  return {
    state,
    codeVerifier,
    createdAt: new Date().toISOString()
  }
}

export function buildOAuthAuthorizeUrlWithConfig(input: {
  oauthUiOrigin: string
  clientId: string
  redirectUri: string
  scope: string
  state: string
  codeChallenge: string
}) {
  const params = new URLSearchParams({
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    responseType: 'code',
    scope: input.scope,
    state: input.state,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: 'S256'
  })

  return `${input.oauthUiOrigin}/authorize?${params.toString()}`
}
