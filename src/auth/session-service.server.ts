import '@tanstack/react-start/server-only'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { AuthError } from './auth-errors'
import { createSessionData, getSessionMaxAgeSeconds, isSessionExpired } from './session-codec'
import type { AppSessionData, AuthUser } from './types'

export const SESSION_NAME = 'cloud_ai_session'
const textEncoder = new TextEncoder()

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET || 'development-session-secret-minimum-32-chars'
  if (secret.length < 32) throw new AuthError('session-create-failed')
  return secret
}

function shouldUseSecureCookie() {
  if (process.env.SESSION_COOKIE_SECURE === 'false') return false
  return process.env.SESSION_COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production'
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: getSessionMaxAgeSeconds()
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


function serializeCookie(name: string, value: string, options: ReturnType<typeof getSessionCookieOptions>) {
  const parts = [`${name}=${value}`, `Path=${options.path}`, `Max-Age=${options.maxAge}`, `SameSite=${options.sameSite}`];
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

export async function createSessionSetCookieHeaderForUserId(userId: string) {
  const value = await createSessionValue(createSessionData(userId));
  return serializeCookie(SESSION_NAME, value, getSessionCookieOptions());
}

export class SessionService {
  async createSessionCookie(user: AuthUser) {
    const value = await createSessionValue(createSessionData(user.id))

    setCookie(SESSION_NAME, value, getSessionCookieOptions())
  }

  async readSession() {
    try {
      const value = getCookie(SESSION_NAME)
      if (!value) return null

      const data = await readSessionValue(value)
      if (!data) return null

      if (isSessionExpired(data)) {
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
