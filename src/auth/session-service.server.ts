import '@tanstack/react-start/server-only'
import { clearSession, getSession, updateSession } from '@tanstack/react-start/server'
import { AuthError } from './auth-errors'
import type { AppSessionData, AuthUser } from './types'

const SESSION_NAME = 'cloud_ai_session'
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function getSessionMaxAge() {
  const parsed = Number(process.env.SESSION_MAX_AGE_SECONDS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_AGE_SECONDS
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET || 'development-session-secret-minimum-32-chars'
  if (secret.length < 32) throw new AuthError('session-create-failed')
  return secret
}

function getSessionConfig() {
  return {
    name: SESSION_NAME,
    password: getSessionSecret(),
    maxAge: getSessionMaxAge(),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/'
    }
  }
}

export class SessionService {
  async createSessionCookie(user: AuthUser) {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + getSessionMaxAge() * 1000)
    await updateSession<AppSessionData>(getSessionConfig(), {
      userId: user.id,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    })
  }

  async readSession() {
    try {
      const session = await getSession<AppSessionData>(getSessionConfig())
      const data = session.data
      if (!data.userId || !data.expiresAt) return null
      if (Date.parse(data.expiresAt) <= Date.now()) {
        await this.clearSessionCookie()
        return null
      }
      return data as AppSessionData
    } catch {
      return null
    }
  }

  async clearSessionCookie() {
    await clearSession(getSessionConfig())
  }
}
