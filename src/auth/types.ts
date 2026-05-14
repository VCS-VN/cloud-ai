export type AuthProvider = 'GOOGLE' | 'GITHUB' | 'MONMI_OAUTH'

export type FirebaseUserProfile = {
  providerUid: string
  password: string | null
  email: string
  emailVerified: boolean
  displayName?: string
  photoUrl?: string
  provider: AuthProvider
}

export type OAuthUserProfile = {
  providerUid: string
  apiKey?: string
  email: string
  emailVerified?: boolean
  displayName?: string
  photoUrl?: string
  provider?: Extract<AuthProvider, 'MONMI_OAUTH'>
}

export type AuthUser = FirebaseUserProfile & {
  id: string
  apiKey?: string
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

export type OAuthCallbackQuery = {
  code?: string
  state?: string
  error?: string
  errorDescription?: string
}

export type OAuthTempSessionData = {
  state: string
  codeVerifier: string
  createdAt: string
}

export type OAuthTokenSet = {
  refreshToken?: string
  expiresIn: number
  tokenType: 'ApiKey'
  apiKey: string
}

export type OAuthMerchantProfile = {
  id: string
  email: string
  name?: string
  identityLogin?: string
  scopes?: string[]
}

export type OAuthLoginInput = {
  code: string
  state: string
  codeVerifier: string
  redirectUri: string
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
  | 'missing-oauth-config'
  | 'oauth-state-mismatch'
  | 'oauth-temp-session-missing'
  | 'oauth-exchange-failed'
  | 'oauth-profile-fetch-failed'
  | 'oauth-login-failed'
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
