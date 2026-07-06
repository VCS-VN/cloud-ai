import { beforeAll, describe, expect, it, vi } from 'vitest'
import { AuthService } from './auth-service'
import { AuthError } from './auth-errors'
import type { AuthUser } from './types'

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

function makeService(overrides: {
  user?: AuthUser
  activateEpisCloud?: ReturnType<typeof vi.fn>
  createAccount?: ReturnType<typeof vi.fn>
  createApiKey?: ReturnType<typeof vi.fn>
  findSettings?: ReturnType<typeof vi.fn>
  saveEpisCloudApiKey?: ReturnType<typeof vi.fn>
} = {}) {
  const user = overrides.user ?? makeUser()
  const activateEpisCloud = overrides.activateEpisCloud ?? vi.fn(async (_id: string, tenantId: string) =>
    makeUser({ episCloudTenantId: tenantId, episCloudActivatedAt: new Date('2026-07-06') })
  )
  const createAccount = overrides.createAccount ?? vi.fn(async () => ({
    tenant_id: 'tenant-abc',
    slug: 'user-1-slug',
    display_name: user.displayName ?? user.email,
    status: 'active',
    created_at: 0
  }))
  const createApiKey = overrides.createApiKey ?? vi.fn(async () => ({
    id: 'key-1',
    raw_secret: 'epis_sk_secret',
    prefix: 'epis_sk_secr…',
    name: 'retail-default',
    monthly_cap_cents: 0,
    created_at: 0
  }))
  const findSettings = overrides.findSettings ?? vi.fn(async () => null)
  const saveEpisCloudApiKey = overrides.saveEpisCloudApiKey ?? vi.fn(async (userId: string, key: {
    encryptedSecret: string
    keyId: string
    prefix: string
  }) => ({
    userId,
    episCloudApiKey: key.encryptedSecret,
    episCloudApiKeyId: key.keyId,
    episCloudApiKeyPrefix: key.prefix
  }))

  const users = {
    findById: vi.fn(async () => user),
    activateEpisCloud
  } as unknown as import('./user-repository').UserRepository

  const sessions = {
    readSession: vi.fn(async () => ({ userId: user.id, issuedAt: '', expiresAt: '' }))
  } as unknown as import('./session-service.server').SessionService

  const merchantGateway = {} as unknown as import('./oauth-client.server').MerchantGatewayClient

  const episCloud = { createAccount, createApiKey } as unknown as import('./episcloud-client.server').EpisCloudClient

  const userSettings = {
    findByUserId: findSettings,
    saveEpisCloudApiKey
  } as unknown as import('./user-settings-repository').UserSettingsRepository

  const service = new AuthService(users, sessions, merchantGateway, episCloud, userSettings)
  return { service, users, createAccount, createApiKey, findSettings, saveEpisCloudApiKey, activateEpisCloud }
}

describe('AuthService.activateEpisCloud', () => {
  beforeAll(() => {
    process.env.USER_API_KEY_ENCRYPTION_KEY = 'test-encryption-key-at-least-32-characters-long'
  })

  it('short-circuits fully when the account and api key already exist', async () => {
    const activatedUser = makeUser({ episCloudTenantId: 'existing-tenant' })
    const findSettings = vi.fn(async () => ({
      userId: 'user-1',
      episCloudApiKey: 'v1:iv:tag:secret',
      episCloudApiKeyId: 'key-1',
      episCloudApiKeyPrefix: 'epis_sk_…'
    }))
    const { service, createAccount, createApiKey, users, saveEpisCloudApiKey } = makeService({
      user: activatedUser,
      findSettings
    })

    const result = await service.activateEpisCloud()

    expect(result.episCloudTenantId).toBe('existing-tenant')
    expect(createAccount).not.toHaveBeenCalled()
    expect(users.activateEpisCloud).not.toHaveBeenCalled()
    expect(createApiKey).not.toHaveBeenCalled()
    expect(saveEpisCloudApiKey).not.toHaveBeenCalled()
  })

  it('creates the account and provisions an encrypted api key on the happy path', async () => {
    const { service, createAccount, createApiKey, activateEpisCloud, saveEpisCloudApiKey } = makeService()

    const result = await service.activateEpisCloud()

    expect(createAccount).toHaveBeenCalledWith({ externalRef: 'user-1', displayName: 'Acme Pho' })
    expect(activateEpisCloud).toHaveBeenCalledWith('user-1', 'tenant-abc')
    expect(createApiKey).toHaveBeenCalledWith({ tenantId: 'tenant-abc', name: 'retail-default' })
    expect(result.episCloudTenantId).toBe('tenant-abc')

    const [savedUserId, savedKey] = saveEpisCloudApiKey.mock.calls[0]
    expect(savedUserId).toBe('user-1')
    expect(savedKey.keyId).toBe('key-1')
    expect(savedKey.prefix).toBe('epis_sk_secr…')
    // The raw secret must be encrypted, never stored verbatim.
    expect(savedKey.encryptedSecret).toMatch(/^v1:/)
    expect(savedKey.encryptedSecret).not.toContain('epis_sk_secret')
  })

  it('provisions the api key even when the tenant already exists but no key is stored', async () => {
    const activatedUser = makeUser({ episCloudTenantId: 'existing-tenant' })
    const { service, createAccount, createApiKey, saveEpisCloudApiKey } = makeService({
      user: activatedUser
    })

    await service.activateEpisCloud()

    expect(createAccount).not.toHaveBeenCalled()
    expect(createApiKey).toHaveBeenCalledWith({ tenantId: 'existing-tenant', name: 'retail-default' })
    expect(saveEpisCloudApiKey).toHaveBeenCalledTimes(1)
  })

  it('surfaces episcloud-activation-failed when the account call fails', async () => {
    const createAccount = vi.fn(async () => {
      throw new AuthError('episcloud-activation-failed')
    })
    const { service } = makeService({ createAccount })

    await expect(service.activateEpisCloud()).rejects.toMatchObject({ code: 'episcloud-activation-failed' })
  })

  it('surfaces episcloud-api-key-failed when the api key call fails', async () => {
    const createApiKey = vi.fn(async () => {
      throw new AuthError('episcloud-api-key-failed')
    })
    const { service } = makeService({ createApiKey })

    await expect(service.activateEpisCloud()).rejects.toMatchObject({ code: 'episcloud-api-key-failed' })
  })
})
