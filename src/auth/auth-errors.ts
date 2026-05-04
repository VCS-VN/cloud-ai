import type { LoginErrorCode } from './types'

const safeMessages: Record<LoginErrorCode, string> = {
  'missing-token': 'Không thể đăng nhập. Vui lòng thử lại.',
  'invalid-token': 'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.',
  'email-not-verified': 'Tài khoản Google cần có email đã xác minh để đăng nhập.',
  'auth-config-error': 'Đăng nhập tạm thời chưa sẵn sàng. Vui lòng thử lại sau.',
  'user-upsert-failed': 'Không thể lưu thông tin người dùng. Vui lòng thử lại.',
  'session-create-failed': 'Không thể tạo phiên đăng nhập. Vui lòng thử lại.',
  unauthorized: 'Bạn cần đăng nhập để tiếp tục.',
  'network-error': 'Kết nối gặp sự cố. Vui lòng kiểm tra mạng và thử lại.',
  'popup-cancelled': 'Bạn đã hủy đăng nhập Google.',
  'popup-blocked': 'Trình duyệt đã chặn cửa sổ đăng nhập. Vui lòng cho phép popup và thử lại.',
  unknown: 'Có lỗi xảy ra. Vui lòng thử lại.'
}

export class AuthError extends Error {
  constructor(readonly code: LoginErrorCode, message = safeMessages[code]) {
    super(message)
    this.name = 'AuthError'
  }
}

export function getSafeAuthMessage(code: LoginErrorCode) {
  return safeMessages[code] ?? safeMessages.unknown
}

export function toSafeAuthError(error: unknown, fallback: LoginErrorCode = 'unknown') {
  if (error instanceof AuthError) return { ok: false as const, code: error.code, message: getSafeAuthMessage(error.code) }
  return { ok: false as const, code: fallback, message: getSafeAuthMessage(fallback) }
}

export function mapFirebaseClientError(error: unknown): LoginErrorCode {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''
  if (code.includes('popup-closed') || code.includes('cancelled')) return 'popup-cancelled'
  if (code.includes('popup-blocked')) return 'popup-blocked'
  if (code.includes('network')) return 'network-error'
  return 'unknown'
}
