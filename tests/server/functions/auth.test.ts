import { describe, expect, it, vi } from 'vitest'
import { AuthService } from '@/auth/auth-service'
import type { AppSessionData, AuthUser } from '@/auth/types'

function createUser(): AuthUser {
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
  }
}

describe('AuthService session user lookup', () => {
  it('returns current user from existing Cloud AI session', async () => {
    const user = createUser()
    const session: AppSessionData = {
      userId: user.id,
      issuedAt: '2026-05-15T00:00:00.000Z',
      expiresAt: '2026-05-22T00:00:00.000Z',
    }
    const users = { findById: vi.fn(async () => user) }
    const sessions = { readSession: vi.fn(async () => session) }
    const service = new AuthService(users as never, sessions as never, {} as never)

    await expect(service.getCurrentUser()).resolves.toEqual({
      id: 'user-1',
      email: 'merchant@example.com',
      emailVerified: true,
      displayName: 'Merchant User',
      photoUrl: undefined,
      provider: 'MONMI_OAUTH',
    })
    expect(users.findById).toHaveBeenCalledWith('user-1')
  })

  it('returns null when no Cloud AI session exists', async () => {
    const users = { findById: vi.fn() }
    const sessions = { readSession: vi.fn(async () => null) }
    const service = new AuthService(users as never, sessions as never, {} as never)

    await expect(service.getCurrentUser()).resolves.toBeNull()
    expect(users.findById).not.toHaveBeenCalled()
  })
})
