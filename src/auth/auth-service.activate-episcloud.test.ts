import { describe, expect, it, vi } from 'vitest'
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

  const users = {
    findById: vi.fn(async () => user),
    activateEpisCloud
  } as unknown as import('./user-repository').UserRepository

  const sessions = {
    readSession: vi.fn(async () => ({ userId: user.id, issuedAt: '', expiresAt: '' }))
  } as unknown as import('./session-service.server').SessionService

  const merchantGateway = {} as unknown as import('./oauth-client.server').MerchantGatewayClient

  const episCloud = { createAccount } as unknown as import('./episcloud-client.server').EpisCloudClient

  const service = new AuthService(users, sessions, merchantGateway, episCloud)
  return { service, users, createAccount, activateEpisCloud }
}

describe('AuthService.activateEpisCloud', () => {
  it('short-circuits without calling the API when already activated', async () => {
    const activatedUser = makeUser({ episCloudTenantId: 'existing-tenant' })
    const { service, createAccount, users } = makeService({ user: activatedUser })

    const result = await service.activateEpisCloud()

    expect(result.episCloudTenantId).toBe('existing-tenant')
    expect(createAccount).not.toHaveBeenCalled()
    expect(users.activateEpisCloud).not.toHaveBeenCalled()
  })

  it('creates the account and persists the returned tenant_id on the happy path', async () => {
    const { service, createAccount, activateEpisCloud } = makeService()

    const result = await service.activateEpisCloud()

    expect(createAccount).toHaveBeenCalledWith({ externalRef: 'user-1', displayName: 'Acme Pho' })
    expect(activateEpisCloud).toHaveBeenCalledWith('user-1', 'tenant-abc')
    expect(result.episCloudTenantId).toBe('tenant-abc')
  })

  it('surfaces episcloud-activation-failed when the API call fails', async () => {
    const createAccount = vi.fn(async () => {
      throw new AuthError('episcloud-activation-failed')
    })
    const { service } = makeService({ createAccount })

    await expect(service.activateEpisCloud()).rejects.toMatchObject({ code: 'episcloud-activation-failed' })
  })
})
