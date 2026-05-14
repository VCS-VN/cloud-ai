import { describe, expect, it, vi } from 'vitest'
import { AuthService } from '@/auth/auth-service'
import type { AuthUser } from '@/auth/types'

function createUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    providerUid: 'merchant-user-1',
    password: null,
    email: 'merchant@example.com',
    emailVerified: true,
    displayName: 'Merchant User',
    photoUrl: undefined,
    provider: 'MONMI_OAUTH',
    createdAt: new Date('2026-05-15T00:00:00.000Z'),
    updatedAt: new Date('2026-05-15T00:00:00.000Z'),
    lastLoginAt: new Date('2026-05-15T00:00:00.000Z'),
    ...overrides,
  }
}

describe('AuthService.signInWithOAuthCode', () => {
  it('exchanges code, loads profile, upserts user, and creates session', async () => {
    const user = createUser()
    const users = { upsertFromOAuth: vi.fn(async () => user) }
    const sessions = { createSessionCookie: vi.fn(async () => undefined) }
    const merchantGateway = {
      exchangeOAuthCode: vi.fn(async () => ({
        tokenType: 'Bearer' as const,
        accessToken: 'access-token',
        expiresIn: 3600,
      })),
      getProfile: vi.fn(async () => ({
        user: { id: 'merchant-user-1', email: 'merchant@example.com', name: 'Merchant User' },
        scopes: ['openid', 'profile', 'cloudAi'],
      })),
    }

    const service = new AuthService(users as never, sessions as never, merchantGateway as never)

    const result = await service.signInWithOAuthCode({
      code: 'code-123',
      state: 'state-123',
      codeVerifier: 'verifier-123',
      redirectUri: 'https://cloud-ai.example.com/auth/callback',
    })

    expect(merchantGateway.exchangeOAuthCode).toHaveBeenCalledWith({
      clientId: 'cloud-ai',
      code: 'code-123',
      codeVerifier: 'verifier-123',
      redirectUri: 'https://cloud-ai.example.com/auth/callback',
    })
    expect(merchantGateway.getProfile).toHaveBeenCalledWith({ accessToken: 'access-token' })
    expect(users.upsertFromOAuth).toHaveBeenCalledWith({
      providerUid: 'merchant-user-1',
      email: 'merchant@example.com',
      displayName: 'Merchant User',
      provider: 'MONMI_OAUTH',
    })
    expect(sessions.createSessionCookie).toHaveBeenCalledWith(user)
    expect(result).toMatchObject({ ok: true, redirectTo: '/dashboard' })
  })


  it('returns safe error when merchant profile hydration fails', async () => {
    const users = { upsertFromOAuth: vi.fn() }
    const sessions = { createSessionCookie: vi.fn() }
    const merchantGateway = {
      exchangeOAuthCode: vi.fn(async () => ({
        tokenType: 'Bearer' as const,
        accessToken: 'access-token',
        expiresIn: 3600,
      })),
      getProfile: vi.fn(async () => {
        throw new Error('profile failed')
      }),
    }
    const service = new AuthService(users as never, sessions as never, merchantGateway as never)

    const result = await service.signInWithOAuthCode({
      code: 'code-123',
      state: 'state-123',
      codeVerifier: 'verifier-123',
      redirectUri: 'https://cloud-ai.example.com/auth/callback',
    })

    expect(result).toMatchObject({ ok: false, code: 'oauth-login-failed' })
    expect(users.upsertFromOAuth).not.toHaveBeenCalled()
    expect(sessions.createSessionCookie).not.toHaveBeenCalled()
  })

  it('returns safe error when required callback fields are missing', async () => {
    const service = new AuthService({} as never, {} as never, {} as never)

    const result = await service.signInWithOAuthCode({
      code: '',
      state: 'state-123',
      codeVerifier: 'verifier-123',
      redirectUri: 'https://cloud-ai.example.com/auth/callback',
    })

    expect(result).toMatchObject({ ok: false, code: 'oauth-login-failed' })
  })
})
