import { describe, expect, it } from 'vitest'
import { AuthError } from '../../src/auth/auth-errors'
import { toAuthUserSummary } from '../../src/auth/user-repository'
import type { AuthUser } from '../../src/auth/types'

const baseUser: AuthUser = {
  id: 'user_1',
  firebaseUid: 'firebase_1',
  email: 'owner@example.com',
  emailVerified: true,
  displayName: 'Owner',
  photoUrl: 'https://example.com/avatar.png',
  authProvider: 'google',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  lastLoginAt: new Date('2026-01-01T00:00:00Z')
}

describe('toAuthUserSummary', () => {
  it('returns only safe client-visible fields', () => {
    expect(toAuthUserSummary(baseUser)).toEqual({
      id: 'user_1',
      email: 'owner@example.com',
      emailVerified: true,
      displayName: 'Owner',
      photoUrl: 'https://example.com/avatar.png',
      authProvider: 'google'
    })
  })

  it('rejects unverified email users', () => {
    expect(() => toAuthUserSummary({ ...baseUser, emailVerified: false })).toThrow(AuthError)
  })
})
