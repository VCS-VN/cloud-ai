import { beforeAll, describe, expect, it, vi } from 'vitest'
import { AuthService } from './auth-service'
import { AuthError } from './auth-errors'
import { encryptUserApiKey } from './api-key-crypto.server'
import type { AuthUser, EpisCloudModel } from './types'

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
  findSettings?: ReturnType<typeof vi.fn>
  listModels?: ReturnType<typeof vi.fn>
} = {}) {
  const user = overrides.user ?? makeUser()
  const findSettings = overrides.findSettings ?? vi.fn(async () => null)
  const listModels = overrides.listModels ?? vi.fn(async () => [] as EpisCloudModel[])

  const users = {
    findById: vi.fn(async () => user)
  } as unknown as import('./user-repository').UserRepository

  const sessions = {
    readSession: vi.fn(async () => ({ userId: user.id, issuedAt: '', expiresAt: '' }))
  } as unknown as import('./session-service.server').SessionService

  const merchantGateway = {} as unknown as import('./oauth-client.server').MerchantGatewayClient
  const episCloud = { listModels } as unknown as import('./episcloud-client.server').EpisCloudClient

  const userSettings = {
    findByUserId: findSettings
  } as unknown as import('./user-settings-repository').UserSettingsRepository

  const service = new AuthService(users, sessions, merchantGateway, episCloud, userSettings)
  return { service, findSettings, listModels }
}

describe('AuthService.listEpisCloudModels', () => {
  beforeAll(() => {
    process.env.USER_API_KEY_ENCRYPTION_KEY = 'test-encryption-key-at-least-32-characters-long'
  })

  it('returns no-api-key when the user has no stored EpisCloud key', async () => {
    const { service, listModels } = makeService({ findSettings: vi.fn(async () => null) })

    const result = await service.listEpisCloudModels()

    expect(result).toEqual({ status: 'no-api-key' })
    expect(listModels).not.toHaveBeenCalled()
  })

  it('decrypts the stored key and returns the gateway model list on success', async () => {
    const models: EpisCloudModel[] = [
      { id: 'episcloud-ai-coder', name: 'AI Coder', ownedBy: 'episcloud' },
      { id: 'episcloud-ai-coder-max', name: 'AI Coder Max', ownedBy: 'episcloud' }
    ]
    const findSettings = vi.fn(async () => ({
      userId: 'user-1',
      episCloudApiKey: encryptUserApiKey('epis_sk_live_secret'),
      episCloudApiKeyId: 'key-1',
      episCloudApiKeyPrefix: 'epis_sk_…'
    }))
    const listModels = vi.fn(async () => models)
    const { service } = makeService({ findSettings, listModels })

    const result = await service.listEpisCloudModels()

    expect(result).toEqual({ status: 'ok', models })
    // The decrypted raw secret — never the encrypted blob — must reach the client.
    expect(listModels).toHaveBeenCalledWith('epis_sk_live_secret')
  })

  it('returns an error result (does not throw) when the gateway call fails', async () => {
    const findSettings = vi.fn(async () => ({
      userId: 'user-1',
      episCloudApiKey: encryptUserApiKey('epis_sk_live_secret'),
      episCloudApiKeyId: 'key-1',
      episCloudApiKeyPrefix: 'epis_sk_…'
    }))
    const listModels = vi.fn(async () => {
      throw new AuthError('episcloud-models-failed')
    })
    const { service } = makeService({ findSettings, listModels })

    const result = await service.listEpisCloudModels()

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.message).toMatch(/could not load available models/i)
    }
  })
})
