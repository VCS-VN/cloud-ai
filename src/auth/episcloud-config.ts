import { AuthError } from './auth-errors'

function requireEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback
  if (!value) throw new AuthError('episcloud-activation-failed')
  return value
}

export function getEpisCloudBaseUrl() {
  return requireEnv('EPISCLOUD_BASE_URL', 'https://dashboard.episcloud.com')
}

export function getEpisCloudPartnerToken() {
  return requireEnv('EPISCLOUD_PARTNER_TOKEN')
}

export function getEpisCloudGatewayBaseUrl() {
  return requireEnv('EPISCLOUD_AIGW_BASE_URL', 'https://paas-ai.episcloud.com/v1')
}
