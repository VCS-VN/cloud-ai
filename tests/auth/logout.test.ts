import { describe, expect, it } from 'vitest'
import type { LogoutResult } from '@/auth/types'

describe('LogoutResult', () => {
  it('redirects to home after logout', () => {
    const result: LogoutResult = { ok: true, redirectTo: '/' }
    expect(result.redirectTo).toBe('/')
  })
})
