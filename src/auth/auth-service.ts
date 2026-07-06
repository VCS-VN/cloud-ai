import { redirect } from '@tanstack/react-router'
import { AuthError, toSafeAuthError } from './auth-errors'
import { mapDecodedTokenToUserProfile, verifyIdToken } from './firebase-admin.server'
import { encryptUserApiKey, decryptUserApiKey } from './api-key-crypto.server'
import { MerchantGatewayClient } from './oauth-client.server'
import { EpisCloudClient } from './episcloud-client.server'
import type { LoginResult, OAuthLoginInput } from './types'
import { toAuthUserSummary, UserRepository } from './user-repository'
import { SessionService } from './session-service.server'

export class AuthService {
  constructor(
    private readonly users = new UserRepository(),
    private readonly sessions = new SessionService(),
    private readonly merchantGateway = new MerchantGatewayClient(),
    private readonly episCloud = new EpisCloudClient()
  ) { }

  async signInWithFirebaseIdToken(idToken: string): Promise<LoginResult> {
    if (!idToken || typeof idToken !== 'string') return toSafeAuthError(new AuthError('missing-token'))

    try {
      const decoded = await verifyIdToken(idToken)
      const profile = mapDecodedTokenToUserProfile(decoded)
      const user = await this.users.upsertFromFirebase(profile)
      await this.sessions.createSessionCookie(user)
      return { ok: true, user: toAuthUserSummary(user), redirectTo: '/dashboard' }
    } catch (error) {
      return toSafeAuthError(error)
    }
  }

  async signInWithOAuthCode(input: OAuthLoginInput): Promise<LoginResult> {
    if (!input.code || !input.state || !input.codeVerifier || !input.redirectUri) {
      return toSafeAuthError(new AuthError('oauth-login-failed'))
    }

    try {
      const tokenSet = await this.merchantGateway.exchangeOAuthCode({
        clientId: 'cloud-ai',
        code: input.code,
        codeVerifier: input.codeVerifier,
        redirectUri: input.redirectUri
      })
      const profile = await this.merchantGateway.getProfile({ apiKey: tokenSet.apiKey })
      const user = await this.users.upsertFromOAuth({
        providerUid: profile.id,
        email: profile.email,
        displayName: profile.name,
        provider: 'MONMI_OAUTH',
        apiKey: encryptUserApiKey(tokenSet.apiKey)
      })

      await this.sessions.createSessionCookie(user)

      return { ok: true, user: toAuthUserSummary(user), redirectTo: '/dashboard' }
    } catch (error) {
      console.error(JSON.stringify({
        event: 'cloud_ai_oauth_login_failed',
        reason: error instanceof AuthError ? error.code : error instanceof Error ? error.message : 'unknown'
      }))
      return toSafeAuthError(error, 'oauth-login-failed')
    }
  }

  async getCurrentUser() {
    const session = await this.sessions.readSession()
    if (!session) return null
    const user = await this.users.findById(session.userId)
    return user ? toAuthUserSummary(user) : null
  }

  async requireUser() {
    const user = await this.getCurrentUser()
    if (!user) throw redirect({ to: '/' })
    return user
  }

  async requireActionUser() {
    const user = await this.getCurrentUser()
    if (!user) throw new AuthError('unauthorized')
    return user
  }

  async updateProfile(fields: {
    displayName: string | null
    bio: string | null
    photoUrl: string | null
    coverImage: string | null
    dateOfBirth: string | null
  }) {
    const current = await this.requireActionUser()
    const updated = await this.users.updateProfile(current.id, fields)
    return toAuthUserSummary(updated)
  }

  async activateEpisCloud() {
    const current = await this.requireActionUser()
    if (current.episCloudTenantId) return current
    const account = await this.episCloud.createAccount({
      externalRef: current.id,
      displayName: current.displayName ?? current.email
    })
    const updated = await this.users.activateEpisCloud(current.id, account.tenant_id)
    return toAuthUserSummary(updated)
  }

  async getPaymentConfig() {
    const current = await this.requireActionUser()
    if (!current.episCloudTenantId) throw new AuthError('episcloud-not-activated')
    return this.episCloud.getPaymentConfig(current.episCloudTenantId)
  }

  async requireMerchantApiKey() {
    const session = await this.sessions.readSession()
    if (!session) throw new AuthError('unauthorized')

    const user = await this.users.findById(session.userId)
    if (!user?.apiKey) throw new AuthError('unauthorized')

    return decryptUserApiKey(user.apiKey)
  }

  async logout() {
    const session = await this.sessions.readSession()
    if (session) await this.users.clearApiKey(session.userId)
    await this.sessions.clearSessionCookie()
    return { ok: true as const, redirectTo: '/' as const }
  }
}

export function getAuthService() {
  return new AuthService()
}
