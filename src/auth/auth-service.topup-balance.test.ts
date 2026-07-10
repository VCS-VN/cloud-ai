import { describe, expect, it, vi } from 'vitest'
import { AuthService } from './auth-service'
import { AuthError } from './auth-errors'
import type { AuthUser, TopupBalanceResult } from './types'

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    providerUid: 'provider-1',
    password: null,
    apiKey: undefined,
    email: 'user@example.com',
    emailVerified: true,
    displayName: 'Acme Pho',
    photoUrl: undefined,
    bio: undefined,
    coverImage: undefined,
    dateOfBirth: undefined,
    episCloudTenantId: undefined,
    episCloudActivatedAt: undefined,
    provider: 'GOOGLE',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    lastLoginAt: new Date('2026-01-01'),
    ...overrides
  }
}

const topupResult: TopupBalanceResult = {
  balance_micro_usd_after: 26_000_000,
  reason: 'partner:acme:order-1',
  credited_amount_micro_usd: 25_000_000
}

function makeService(overrides: {
  user?: AuthUser
  topupBalance?: ReturnType<typeof vi.fn>
} = {}) {
  const user = overrides.user ?? makeUser()
  const topupBalance = overrides.topupBalance ?? vi.fn(async () => topupResult)

  const users = {
    findById: vi.fn(async () => user)
  } as unknown as import('./user-repository').UserRepository

  const sessions = {
    readSession: vi.fn(async () => ({ userId: user.id, issuedAt: '', expiresAt: '' }))
  } as unknown as import('./session-service.server').SessionService

  const merchantGateway = {} as unknown as import('./oauth-client.server').MerchantGatewayClient
  const episCloud = { topupBalance } as unknown as import('./episcloud-client.server').EpisCloudClient

  const service = new AuthService(users, sessions, merchantGateway, episCloud)
  return { service, topupBalance }
}

describe('AuthService.topupBalance', () => {
  it('tops up using the stored tenant id as intent id', async () => {
    const user = makeUser({ episCloudTenantId: 'tenant-abc' })
    const { service, topupBalance } = makeService({ user })

    const result = await service.topupBalance({
      amountMicroUsd: 25_000_000,
      reason: 'order-1',
      paymentMethodId: 'pm-1'
    })

    expect(topupBalance).toHaveBeenCalledWith('tenant-abc', {
      amountMicroUsd: 25_000_000,
      reason: 'order-1',
      paymentMethodId: 'pm-1'
    })
    expect(result).toEqual(topupResult)
  })

  it('throws episcloud-not-activated when the user has no tenant id', async () => {
    const { service, topupBalance } = makeService()

    await expect(
      service.topupBalance({ amountMicroUsd: 25_000_000, reason: 'order-1' })
    ).rejects.toMatchObject({ code: 'episcloud-not-activated' })
    expect(topupBalance).not.toHaveBeenCalled()
  })

  it('rejects non-positive amounts before calling the API', async () => {
    const { service, topupBalance } = makeService({
      user: makeUser({ episCloudTenantId: 'tenant-abc' })
    })

    await expect(
      service.topupBalance({ amountMicroUsd: 0, reason: 'order-1' })
    ).rejects.toMatchObject({ code: 'topup-failed' })
    expect(topupBalance).not.toHaveBeenCalled()
  })

  it('surfaces topup-failed when the API call fails', async () => {
    const topupBalance = vi.fn(async () => {
      throw new AuthError('topup-failed')
    })
    const { service } = makeService({
      user: makeUser({ episCloudTenantId: 'tenant-abc' }),
      topupBalance
    })

    await expect(
      service.topupBalance({ amountMicroUsd: 25_000_000, reason: 'order-1' })
    ).rejects.toMatchObject({ code: 'topup-failed' })
  })
})
