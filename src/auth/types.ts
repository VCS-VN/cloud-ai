export type AuthProvider = 'GOOGLE' | 'GITHUB'

export type FirebaseUserProfile = {
  providerUid: string
  password: string | null
  email: string
  emailVerified: boolean
  displayName?: string
  photoUrl?: string
  provider: AuthProvider
}

export type AuthUser = FirebaseUserProfile & {
  id: string
  createdAt: Date
  updatedAt: Date
  lastLoginAt: Date
}

export type AuthUserSummary = {
  id: string
  email: string
  emailVerified: true
  displayName?: string
  photoUrl?: string
  provider: AuthProvider
}

export type CurrentUserResult = {
  user: AuthUserSummary | null
}

export type LoginSuccess = {
  ok: true
  user: AuthUserSummary
  redirectTo: '/dashboard'
}

export type LoginErrorCode =
  | 'missing-token'
  | 'invalid-token'
  | 'email-not-verified'
  | 'auth-config-error'
  | 'user-upsert-failed'
  | 'session-create-failed'
  | 'unauthorized'
  | 'network-error'
  | 'popup-cancelled'
  | 'popup-blocked'
  | 'unauthorized-domain'
  | 'operation-not-allowed'
  | 'invalid-client-config'
  | 'unknown'

export type LoginError = {
  ok: false
  code: LoginErrorCode
  message: string
}

export type LoginResult = LoginSuccess | LoginError

export type LogoutResult = {
  ok: true
  redirectTo: '/'
}

export type AppSessionData = {
  userId: string
  issuedAt: string
  expiresAt: string
}
