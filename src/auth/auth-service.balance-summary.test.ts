import { describe, expect, it, vi } from 'vitest'
import { AuthService } from './auth-service'
import { AuthError } from './auth-errors'
import type { AuthUser, BalanceSummary } from './types'

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

const summary: BalanceSummary = {
  tenant_id: 'tenant-abc',
  remaining_micro_usd: 7_000_000,
  credited_total_micro_usd: 7_000_000,
  used_total_micro_usd: 0,
  topup_count: 1,
  currency: 'USD',
  updated_at: 1_781_887_111
}

function makeService(overrides: {
  user?: AuthUser
  getBalanceSummary?: ReturnType<typeof vi.fn>
} = {}) {
  const user = overrides.user ?? makeUser()
  const getBalanceSummary = overrides.getBalanceSummary ?? vi.fn(async () => summary)

  const users = {
    findById: vi.fn(async () => user)
  } as unknown as import('./user-repository').UserRepository

  const sessions = {
    readSession: vi.fn(async () => ({ userId: user.id, issuedAt: '', expiresAt: '' }))
  } as unknown as import('./session-service.server').SessionService

  const merchantGateway = {} as unknown as import('./oauth-client.server').MerchantGatewayClient
  const episCloud = { getBalanceSummary } as unknown as import('./episcloud-client.server').EpisCloudClient

  const service = new AuthService(users, sessions, merchantGateway, episCloud)
  return { service, getBalanceSummary }
}

describe('AuthService.getBalanceSummary', () => {
  it('fetches the summary using the stored tenant id as intent id', async () => {
    const user = makeUser({ episCloudTenantId: 'tenant-abc' })
    const { service, getBalanceSummary } = makeService({ user })

    const result = await service.getBalanceSummary()

    expect(getBalanceSummary).toHaveBeenCalledWith('tenant-abc')
    expect(result).toEqual(summary)
  })

  it('throws episcloud-not-activated when the user has no tenant id', async () => {
    const { service, getBalanceSummary } = makeService()

    await expect(service.getBalanceSummary()).rejects.toMatchObject({
      code: 'episcloud-not-activated'
    })
    expect(getBalanceSummary).not.toHaveBeenCalled()
  })

  it('surfaces balance-summary-failed when the API call fails', async () => {
    const getBalanceSummary = vi.fn(async () => {
      throw new AuthError('balance-summary-failed')
    })
    const { service } = makeService({
      user: makeUser({ episCloudTenantId: 'tenant-abc' }),
      getBalanceSummary
    })

    await expect(service.getBalanceSummary()).rejects.toMatchObject({
      code: 'balance-summary-failed'
    })
  })
})
