import type { AppSessionData } from './types'

export const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export function getSessionMaxAgeSeconds(value = process.env.SESSION_MAX_AGE_SECONDS) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SESSION_MAX_AGE_SECONDS
}

export function createSessionData(userId: string, now = new Date(), maxAgeSeconds = getSessionMaxAgeSeconds()): AppSessionData {
  const expiresAt = new Date(now.getTime() + maxAgeSeconds * 1000)
  return {
    userId,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  }
}

export function isSessionExpired(data: Pick<AppSessionData, 'expiresAt'>, now = Date.now()) {
  return Date.parse(data.expiresAt) <= now
}
