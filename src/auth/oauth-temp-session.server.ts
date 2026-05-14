import '@tanstack/react-start/server-only'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { AuthError } from './auth-errors'
import { createOAuthTempSessionData } from './oauth-utils'
import type { OAuthTempSessionData } from './types'

const COOKIE_NAME = 'cloud_ai_oauth_temp'
const MAX_AGE_SECONDS = 10 * 60
const textEncoder = new TextEncoder()

function getSecret() {
  const secret = process.env.SESSION_SECRET || 'development-session-secret-minimum-32-chars'
  if (secret.length < 32) throw new AuthError('missing-oauth-config')
  return secret
}

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.SESSION_COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: MAX_AGE_SECONDS
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
    textEncoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload))
  return base64UrlEncode(new Uint8Array(signature))
}

async function createCookieValue(data: OAuthTempSessionData) {
  const payload = base64UrlEncode(JSON.stringify(data))
  const signature = await createSignature(payload)
  return `${payload}.${signature}`
}

async function readCookieValue(value: string): Promise<OAuthTempSessionData | null> {
  const [payload, signature] = value.split('.')
  if (!payload || !signature) return null

  const expectedSignature = await createSignature(payload)
  if (signature !== expectedSignature) return null

  const parsed = JSON.parse(base64UrlDecode(payload)) as Partial<OAuthTempSessionData>
  if (!parsed.state || !parsed.codeVerifier || !parsed.createdAt) return null
  return parsed as OAuthTempSessionData
}

export async function createOAuthTempSession(data: OAuthTempSessionData) {
  const value = await createCookieValue(data)
  setCookie(COOKIE_NAME, value, getCookieOptions())
}

export async function readOAuthTempSession() {
  try {
    const value = getCookie(COOKIE_NAME)
    if (!value) return null
    const data = await readCookieValue(value)
    if (!data) return null
    if (Date.parse(data.createdAt) + MAX_AGE_SECONDS * 1000 <= Date.now()) {
      await clearOAuthTempSession()
      return null
    }
    return data
  } catch {
    return null
  }
}

export async function clearOAuthTempSession() {
  deleteCookie(COOKIE_NAME, { path: '/' })
}

