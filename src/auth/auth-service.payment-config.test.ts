import { describe, expect, it, vi } from 'vitest'
import { AuthService } from './auth-service'
import { AuthError } from './auth-errors'
import type { AuthUser, PaymentConfig } from './types'

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

const paymentConfig: PaymentConfig = {
  stripe: {
    enabled: true,
    publishable_key: 'pk_test',
    setup_intent_client_secret: 'seti_secret',
    setup_intent_id: 'seti_1'
  },
  paypal: { enabled: true, client_id: 'cid', vault_token: 'vt', env: 'live' }
}

function makeService(overrides: {
  user?: AuthUser
  getPaymentConfig?: ReturnType<typeof vi.fn>
} = {}) {
  const user = overrides.user ?? makeUser()
  const getPaymentConfig = overrides.getPaymentConfig ?? vi.fn(async () => paymentConfig)

  const users = {
    findById: vi.fn(async () => user)
  } as unknown as import('./user-repository').UserRepository

  const sessions = {
    readSession: vi.fn(async () => ({ userId: user.id, issuedAt: '', expiresAt: '' }))
  } as unknown as import('./session-service.server').SessionService

  const merchantGateway = {} as unknown as import('./oauth-client.server').MerchantGatewayClient
  const episCloud = { getPaymentConfig } as unknown as import('./episcloud-client.server').EpisCloudClient

  const service = new AuthService(users, sessions, merchantGateway, episCloud)
  return { service, getPaymentConfig }
}

describe('AuthService.getPaymentConfig', () => {
  it('fetches the config using the stored tenant id as intent id', async () => {
    const user = makeUser({ episCloudTenantId: 'tenant-abc' })
    const { service, getPaymentConfig } = makeService({ user })

    const result = await service.getPaymentConfig()

    expect(getPaymentConfig).toHaveBeenCalledWith('tenant-abc')
    expect(result).toEqual(paymentConfig)
  })

  it('throws episcloud-not-activated when the user has no tenant id', async () => {
    const { service, getPaymentConfig } = makeService()

    await expect(service.getPaymentConfig()).rejects.toMatchObject({ code: 'episcloud-not-activated' })
    expect(getPaymentConfig).not.toHaveBeenCalled()
  })

  it('surfaces payment-config-failed when the API call fails', async () => {
    const getPaymentConfig = vi.fn(async () => {
      throw new AuthError('payment-config-failed')
    })
    const { service } = makeService({
      user: makeUser({ episCloudTenantId: 'tenant-abc' }),
      getPaymentConfig
    })

    await expect(service.getPaymentConfig()).rejects.toMatchObject({ code: 'payment-config-failed' })
  })
})
