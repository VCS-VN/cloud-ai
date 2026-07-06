import { AuthError } from './auth-errors'

function requireEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback
  if (!value) throw new AuthError('missing-oauth-config')
  return value
}

export function getOauthClientId() {
  return requireEnv('OAUTH_CLIENT_ID', 'cloud-ai')
}

export function getMerchantApiBaseUrl() {
  return requireEnv('MERCHANT_API_BASE_URL',)
}
