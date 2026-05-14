import { describe, expect, it } from 'vitest'
import { buildOAuthAuthorizeUrlWithConfig, createOAuthTempSessionData, createPkcePair } from '@/auth/oauth-utils'

describe('OAuth temp session and PKCE helpers', () => {
  it('creates temp session data with state, verifier, and timestamp', () => {
    const data = createOAuthTempSessionData('state-123', 'verifier-123')

    expect(data).toMatchObject({ state: 'state-123', codeVerifier: 'verifier-123' })
    expect(Date.parse(data.createdAt)).not.toBeNaN()
  })

  it('creates a S256 PKCE verifier and challenge pair', async () => {
    const pair = await createPkcePair()

    expect(pair.codeVerifier.length).toBeGreaterThanOrEqual(70)
    expect(pair.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(pair.codeChallenge).not.toBe(pair.codeVerifier)
  })

  it('builds authorize URL with cloud-ai OAuth parameters', () => {
    const url = new URL(
      buildOAuthAuthorizeUrlWithConfig({
        oauthUiOrigin: 'https://oauth-ui.example.com',
        clientId: 'cloud-ai',
        redirectUri: 'https://cloud-ai.example.com/auth/callback',
        scope: 'openid profile store cloudAi',
        state: 'state-123',
        codeChallenge: 'challenge-123',
      }),
    )

    expect(url.origin).toBe('https://oauth-ui.example.com')
    expect(url.pathname).toBe('/authorize')
    expect(url.searchParams.get('clientId')).toBe('cloud-ai')
    expect(url.searchParams.get('redirectUri')).toBe('https://cloud-ai.example.com/auth/callback')
    expect(url.searchParams.get('responseType')).toBe('code')
    expect(url.searchParams.get('state')).toBe('state-123')
    expect(url.searchParams.get('codeChallenge')).toBe('challenge-123')
    expect(url.searchParams.get('codeChallengeMethod')).toBe('S256')
  })
})
