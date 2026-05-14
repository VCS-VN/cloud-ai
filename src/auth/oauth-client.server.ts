import '@tanstack/react-start/server-only'
import axios, { AxiosError } from 'axios'
import { AuthError } from './auth-errors'
import { getMerchantApiBaseUrl, getOauthClientId, getOauthRedirectUri, getOauthScope, getOauthUiOrigin } from './oauth-config'
import { buildOAuthAuthorizeUrlWithConfig } from './oauth-utils'
import type { OAuthMerchantProfile, OAuthTokenSet } from './types'

export function buildOAuthAuthorizeUrl(input: { state: string; codeChallenge: string; redirectUri?: string }) {
  return buildOAuthAuthorizeUrlWithConfig({
    oauthUiOrigin: getOauthUiOrigin(),
    clientId: getOauthClientId(),
    redirectUri: input.redirectUri ?? getOauthRedirectUri(),
    scope: getOauthScope(),
    state: input.state,
    codeChallenge: input.codeChallenge
  })
}

function toAuthError(error: unknown, code: 'oauth-exchange-failed' | 'oauth-profile-fetch-failed') {
  if (error instanceof AuthError) return error
  if (error instanceof AxiosError) return new AuthError(code)
  return new AuthError(code)
}

function assertTokenSet(value: OAuthTokenSet) {
  if (!value?.accessToken || typeof value.accessToken !== 'string') throw new AuthError('oauth-exchange-failed')
  if (value.tokenType && value.tokenType !== 'Bearer') throw new AuthError('oauth-exchange-failed')
}

function assertMerchantProfile(value: OAuthMerchantProfile) {
  if (!value?.id || !value.email) throw new AuthError('oauth-profile-fetch-failed')
}

export class MerchantGatewayClient {
  async exchangeOAuthCode(input: {
    clientId: 'cloud-ai'
    code: string
    codeVerifier: string
    redirectUri: string
  }): Promise<OAuthTokenSet> {
    try {
      const response = await axios.post<OAuthTokenSet>(
        `${getMerchantApiBaseUrl()}/api/v2/auth/oauth/exchange`,
        input,
        { headers: { 'content-type': 'application/json' } }
      )
      assertTokenSet(response.data)
      return response.data
    } catch (error) {
      throw toAuthError(error, 'oauth-exchange-failed')
    }
  }

  async getProfile(input: { accessToken: string }): Promise<OAuthMerchantProfile> {
    try {
      const response = await axios.get<OAuthMerchantProfile>(`${getMerchantApiBaseUrl()}/api/v1/auth/profile`, {
        headers: { authorization: `Bearer ${input.accessToken}` }
      })

      assertMerchantProfile(response.data)
      return response.data
    } catch (error) {
      throw toAuthError(error, 'oauth-profile-fetch-failed')
    }
  }
}
