import { describe, expect, it } from 'vitest'
import { getSafeAuthMessage } from '../../src/auth/auth-errors'

describe('session safety messages', () => {
  it('uses a safe message when session creation fails', () => {
    expect(getSafeAuthMessage('session-create-failed')).toBe('Không thể tạo phiên đăng nhập. Vui lòng thử lại.')
  })
})
