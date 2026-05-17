import '@tanstack/react-start/server-only'
import axios, { AxiosError } from 'axios'
import type { StoreListResult, StoreOption } from '@/shared/project-types'
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
  if (!value?.apiKey || typeof value.apiKey !== 'string') throw new AuthError('oauth-exchange-failed')
  if (value.tokenType && value.tokenType !== 'ApiKey') throw new AuthError('oauth-exchange-failed')
}

function assertMerchantProfile(value: OAuthMerchantProfile) {
  if (!value?.id || !value.email) throw new AuthError('oauth-profile-fetch-failed')
}

function normalizeStoreList(value: unknown, page: number, limit: number): StoreListResult {
  const source = value as {
    data?: unknown
    stores?: unknown
    items?: unknown
    total?: unknown
    hasMore?: unknown
    meta?: { total?: unknown; hasMore?: unknown }
  }
  const rawStores = Array.isArray(source.data)
    ? source.data
    : Array.isArray(source.stores)
      ? source.stores
      : Array.isArray(source.items)
        ? source.items
        : []

  const stores = rawStores
    .map((item): StoreOption | null => {
      const store = item as {
        id?: unknown
        _id?: unknown
        slug?: unknown
        name?: unknown
        displayName?: unknown
        title?: unknown
      }
      const slug = typeof store.slug === 'string' ? store.slug : undefined
      const displayName = typeof store.displayName === 'string'
        ? store.displayName
        : typeof store.name === 'string'
          ? store.name
          : typeof store.title === 'string'
            ? store.title
            : slug
      return slug && displayName ? { slug, displayName } : null
    })
    .filter((store): store is StoreOption => store !== null)

  const total = typeof source.total === 'number'
    ? source.total
    : typeof source.meta?.total === 'number'
      ? source.meta.total
      : undefined
  const hasMore = typeof source.hasMore === 'boolean'
    ? source.hasMore
    : typeof source.meta?.hasMore === 'boolean'
      ? source.meta.hasMore
      : total === undefined
        ? stores.length === limit
        : page * limit < total

  return { stores, page, limit, total, hasMore }
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

  async getProfile(input: { apiKey: string }): Promise<OAuthMerchantProfile> {
    try {
      const response = await axios.get<OAuthMerchantProfile>(`${getMerchantApiBaseUrl()}/api/v1/auth/profile`, {
        headers: {
          'x-epis-key': input.apiKey
        }
      })

      assertMerchantProfile(response.data)
      return response.data
    } catch (error) {
      throw toAuthError(error, 'oauth-profile-fetch-failed')
    }
  }

  async getStores(input: { apiKey: string; page?: number; limit?: number; search?: string }): Promise<StoreListResult> {
    const page = Math.max(1, input.page ?? 1)
    const limit = Math.max(1, Math.min(input.limit ?? 10, 50))

    try {
      const response = await axios.get(`${getMerchantApiBaseUrl()}/api/v1/stores`, {
        headers: {
          'x-epis-key': input.apiKey
        },
        params: {
          page,
          limit,
          search: input.search?.trim() || undefined,
          businessType: 'RETAIL'
        }
      })

      return normalizeStoreList(response.data, page, limit)
    } catch (error) {
      throw toAuthError(error, 'oauth-profile-fetch-failed')
    }
  }
}
