import { describe, expect, it, vi } from 'vitest'
import { handleOAuthCallback } from '@/auth/oauth-callback-handler'
import type { LoginResult, OAuthTempSessionData } from '@/auth/types'

function createDependencies(options: {
  temp?: OAuthTempSessionData | null
  result?: LoginResult
}) {
  return {
    clearTempSession: vi.fn(async () => undefined),
    readTempSession: vi.fn(async () => options.temp ?? null),
    signInWithOAuthCode: vi.fn(async () =>
      options.result ?? {
        ok: true as const,
        user: {
          id: 'user-1',
          email: 'merchant@example.com',
          emailVerified: true as const,
          provider: 'MONMI_OAUTH' as const,
        },
        redirectTo: '/dashboard' as const,
      },
    ),
    getCloudAiOrigin: () => 'https://cloud-ai.example.com',
    getOauthRedirectUri: () => 'https://cloud-ai.example.com/auth/callback',
  }
}

describe('handleOAuthCallback', () => {
  it('redirects with safe error when callback has OAuth error', async () => {
    const dependencies = createDependencies({ temp: null })

    const result = await handleOAuthCallback({ error: 'access_denied' }, dependencies)

    expect(result.redirectHref).toBe('https://cloud-ai.example.com/?error=access_denied')
    expect(dependencies.clearTempSession).toHaveBeenCalledTimes(1)
    expect(dependencies.signInWithOAuthCode).not.toHaveBeenCalled()
  })

  it('rejects missing callback params', async () => {
    const dependencies = createDependencies({ temp: null })

    const result = await handleOAuthCallback({ code: 'code-123' }, dependencies)

    expect(result.redirectHref).toBe('https://cloud-ai.example.com/?error=missingOAuthCallbackParams')
    expect(dependencies.clearTempSession).toHaveBeenCalledTimes(1)
    expect(dependencies.signInWithOAuthCode).not.toHaveBeenCalled()
  })

  it('rejects mismatched state before exchange', async () => {
    const dependencies = createDependencies({
      temp: { state: 'expected-state', codeVerifier: 'verifier-123', createdAt: new Date().toISOString() },
    })

    const result = await handleOAuthCallback({ code: 'code-123', state: 'wrong-state' }, dependencies)

    expect(result.redirectHref).toBe('https://cloud-ai.example.com/?error=stateMismatch')
    expect(dependencies.clearTempSession).toHaveBeenCalledTimes(1)
    expect(dependencies.signInWithOAuthCode).not.toHaveBeenCalled()
  })

  it('exchanges code and redirects to dashboard on success', async () => {
    const dependencies = createDependencies({
      temp: { state: 'state-123', codeVerifier: 'verifier-123', createdAt: new Date().toISOString() },
    })

    const result = await handleOAuthCallback({ code: 'code-123', state: 'state-123' }, dependencies)

    expect(dependencies.signInWithOAuthCode).toHaveBeenCalledWith({
      code: 'code-123',
      state: 'state-123',
      codeVerifier: 'verifier-123',
      redirectUri: 'https://cloud-ai.example.com/auth/callback',
    })
    expect(dependencies.clearTempSession).toHaveBeenCalledTimes(1)
    expect(result.redirectHref).toBe('https://cloud-ai.example.com/dashboard')
  })
})
