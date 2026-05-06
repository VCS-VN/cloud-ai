import { redirect } from '@tanstack/react-router'
import { AuthError, toSafeAuthError } from './auth-errors'
import { mapDecodedTokenToUserProfile, verifyIdToken } from './firebase-admin.server'
import { SessionService } from './session-service.server'
import type { AuthUserSummary, LoginResult } from './types'
import { toAuthUserSummary, UserRepository } from './user-repository'

export class AuthService {
  constructor(
    private readonly users = new UserRepository(),
    private readonly sessions = new SessionService()
  ) {}

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

  async getCurrentUser(): Promise<AuthUserSummary | null> {
    const session = await this.sessions.readSession()
    if (!session) return null
    const user = await this.users.findById(session.userId)
    return user ? toAuthUserSummary(user) : null
  }

  async requireUser(): Promise<AuthUserSummary> {
    const user = await this.getCurrentUser()
    if (!user) throw redirect({ to: '/' })
    return user
  }

  async requireActionUser(): Promise<AuthUserSummary> {
    const user = await this.getCurrentUser()
    if (!user) throw new AuthError('unauthorized')
    return user
  }

  async logout() {
    await this.sessions.clearSessionCookie()
    return { ok: true as const, redirectTo: '/' as const }
  }
}

export function getAuthService() {
  return new AuthService()
}
