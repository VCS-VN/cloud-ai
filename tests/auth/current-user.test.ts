import { describe, expect, it } from 'vitest'
import type { CurrentUserResult } from '../../src/auth/types'

describe('CurrentUserResult', () => {
  it('allows null for signed-out state', () => {
    const result: CurrentUserResult = { user: null }
    expect(result.user).toBeNull()
  })
})
