import { AuthError } from './auth-errors'

function requireEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback
  if (!value) throw new AuthError('missing-oauth-config')
  return value
}

export function getCloudAiOrigin() {
  return requireEnv('CLOUD_AI_ORIGIN', 'http://localhost:3001')
}

export function getOauthUiOrigin() {
  return requireEnv('OAUTH_UI_ORIGIN', 'http://localhost:3000')
}

export function getOauthClientId() {
  return requireEnv('OAUTH_CLIENT_ID', 'cloud-ai')
}

export function getOauthRedirectUri() {
  return requireEnv('OAUTH_REDIRECT_URI', `${getCloudAiOrigin()}/auth/callback`)
}

export function getMerchantApiBaseUrl() {
  return requireEnv('MERCHANT_API_BASE_URL',)
}

export function getOauthScope() {
  return 'profile store'
}
