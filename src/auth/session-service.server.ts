import '@tanstack/react-start/server-only'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { AuthError } from './auth-errors'
import type { AppSessionData, AuthUser } from './types'

const SESSION_NAME = 'cloud_ai_session'
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7
const textEncoder = new TextEncoder()

function getSessionMaxAge() {
  const parsed = Number(process.env.SESSION_MAX_AGE_SECONDS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_AGE_SECONDS
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET || 'development-session-secret-minimum-32-chars'
  if (secret.length < 32) throw new AuthError('session-create-failed')
  return secret
}

function shouldUseSecureCookie() {
  if (process.env.SESSION_COOKIE_SECURE === 'false') return false
  return process.env.SESSION_COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production'
}

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: getSessionMaxAge()
  }
}

function base64UrlEncode(value: Uint8Array | string) {
  const bytes = typeof value === 'string' ? textEncoder.encode(value) : value
  return Buffer.from(bytes).toString('base64url')
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

async function createSignature(payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(getSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload))
  return base64UrlEncode(new Uint8Array(signature))
}

async function createSessionValue(data: AppSessionData) {
  const payload = base64UrlEncode(JSON.stringify(data))
  const signature = await createSignature(payload)
  return `${payload}.${signature}`
}

async function readSessionValue(value: string): Promise<AppSessionData | null> {
  const [payload, signature] = value.split('.')
  if (!payload || !signature) return null

  const expectedSignature = await createSignature(payload)
  if (signature !== expectedSignature) return null

  const parsed = JSON.parse(base64UrlDecode(payload)) as Partial<AppSessionData>
  if (!parsed.userId || !parsed.expiresAt || !parsed.issuedAt) return null
  return parsed as AppSessionData
}

export class SessionService {
  async createSessionCookie(user: AuthUser) {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + getSessionMaxAge() * 1000)
    const value = await createSessionValue({
      userId: user.id,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    })

    setCookie(SESSION_NAME, value, getCookieOptions())
  }

  async readSession() {
    try {
      const value = getCookie(SESSION_NAME)
      if (!value) return null

      const data = await readSessionValue(value)
      if (!data) return null

      if (Date.parse(data.expiresAt) <= Date.now()) {
        await this.clearSessionCookie()
        return null
      }

      return data
    } catch {
      return null
    }
  }

  async clearSessionCookie() {
    deleteCookie(SESSION_NAME, { path: '/' })
  }
}
