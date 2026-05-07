import { describe, expect, it } from 'vitest'
import { getSafeAuthMessage } from '@/auth/auth-errors'

describe('session safety messages', () => {
  it('uses a safe message when session creation fails', () => {
    expect(getSafeAuthMessage('session-create-failed')).toBe('Unable to create a sign-in session. Please try again.')
  })
})
