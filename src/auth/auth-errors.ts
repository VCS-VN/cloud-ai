import type { LoginErrorCode } from './types'

const safeMessages: Record<LoginErrorCode, string> = {
  'missing-token': 'Unable to sign in. Please try again.',
  'invalid-token': 'Your Google sign-in session is invalid or expired. Please try again.',
  'email-not-verified': 'Your Google account must have a verified email address to sign in.',
  'auth-config-error': 'Sign-in is temporarily unavailable. Please try again later.',
  'user-upsert-failed': 'Unable to save user information. Please try again.',
  'session-create-failed': 'Unable to create a sign-in session. Please try again.',
  unauthorized: 'You need to sign in to continue.',
  'network-error': 'A connection issue occurred. Please check your network and try again.',
  'popup-cancelled': 'You cancelled Google sign-in.',
  'popup-blocked': 'Your browser blocked the sign-in window. Please allow popups and try again.',
  'unauthorized-domain': 'This domain is not authorized for Google sign-in. Add it in Firebase Authentication settings.',
  'operation-not-allowed': 'Google sign-in is not enabled for this Firebase project.',
  'invalid-client-config': 'Firebase sign-in configuration is invalid for this environment.',
  unknown: 'Something went wrong. Please try again.'
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
  if (code.includes('unauthorized-domain')) return 'unauthorized-domain'
  if (code.includes('operation-not-allowed')) return 'operation-not-allowed'
  if (code.includes('invalid-api-key') || code.includes('invalid-app-credential') || code.includes('app-not-authorized')) return 'invalid-client-config'
  if (code.includes('popup-closed') || code.includes('cancelled')) return 'popup-cancelled'
  if (code.includes('popup-blocked')) return 'popup-blocked'
  if (code.includes('network')) return 'network-error'
  return 'unknown'
}
