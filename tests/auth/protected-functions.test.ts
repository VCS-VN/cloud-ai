import { describe, expect, it } from 'vitest'
import { getSafeAuthMessage } from '@/auth/auth-errors'

describe('protected function errors', () => {
  it('uses a safe unauthorized message', () => {
    expect(getSafeAuthMessage('unauthorized')).toBe('You need to sign in to continue.')
  })
})
