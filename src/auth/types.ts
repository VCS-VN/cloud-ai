export type AuthProvider = 'google'

export type FirebaseUserProfile = {
  firebaseUid: string
  email: string
  emailVerified: boolean
  displayName?: string
  photoUrl?: string
  authProvider: AuthProvider
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
  authProvider: AuthProvider
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
