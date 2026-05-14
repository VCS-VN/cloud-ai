import { describe, expect, it } from 'vitest'
import { createSessionData, getSessionMaxAgeSeconds, isSessionExpired } from '@/auth/session-codec'

describe('session codec', () => {
  it('creates Cloud AI session data with issued and expiry timestamps', () => {
    const now = new Date('2026-05-15T00:00:00.000Z')
    const session = createSessionData('user-1', now, 60)

    expect(session).toEqual({
      userId: 'user-1',
      issuedAt: '2026-05-15T00:00:00.000Z',
      expiresAt: '2026-05-15T00:01:00.000Z'
    })
  })

  it('detects valid and expired session states', () => {
    const session = createSessionData('user-1', new Date('2026-05-15T00:00:00.000Z'), 60)

    expect(isSessionExpired(session, Date.parse('2026-05-15T00:00:30.000Z'))).toBe(false)
    expect(isSessionExpired(session, Date.parse('2026-05-15T00:01:00.000Z'))).toBe(true)
  })

  it('falls back to default max age for invalid config', () => {
    expect(getSessionMaxAgeSeconds('bad-value')).toBe(60 * 60 * 24 * 7)
    expect(getSessionMaxAgeSeconds('-1')).toBe(60 * 60 * 24 * 7)
    expect(getSessionMaxAgeSeconds('120')).toBe(120)
  })
})
