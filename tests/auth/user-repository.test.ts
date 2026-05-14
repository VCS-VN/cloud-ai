import { describe, expect, it } from 'vitest'
import type { OAuthUserProfile } from '@/auth/types'

describe('OAuth user profile contract', () => {
  it('does not include storeId in initial OAuth user profile shape', () => {
    const profile: OAuthUserProfile = {
      providerUid: 'merchant-user-1',
      email: 'merchant@example.com',
      displayName: 'Merchant User',
      provider: 'MONMI_OAUTH',
    }

    expect(profile).not.toHaveProperty('storeId')
    expect(profile).toMatchObject({
      providerUid: 'merchant-user-1',
      email: 'merchant@example.com',
      displayName: 'Merchant User',
      provider: 'MONMI_OAUTH',
    })
  })
})
