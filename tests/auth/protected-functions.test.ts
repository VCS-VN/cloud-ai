import { describe, expect, it } from 'vitest'
import { getSafeAuthMessage } from '../../src/auth/auth-errors'

describe('protected function errors', () => {
  it('uses a safe unauthorized message', () => {
    expect(getSafeAuthMessage('unauthorized')).toBe('Bạn cần đăng nhập để tiếp tục.')
  })
})
