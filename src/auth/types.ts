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
  bio?: string
  coverImage?: string
  dateOfBirth?: string
  episCloudTenantId?: string
  episCloudActivatedAt?: Date
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
  bio?: string
  coverImage?: string
  dateOfBirth?: string
  episCloudTenantId?: string
  episCloudActivatedAt?: Date
  provider: AuthProvider
}

export type StripePaymentConfig = {
  enabled: boolean
  publishable_key: string
  setup_intent_client_secret: string
  setup_intent_id: string
}

export type PaypalPaymentConfig = {
  enabled: boolean
  client_id: string
  vault_token: string
  env: 'live' | 'sandbox'
}

export type PaymentConfig = {
  stripe: StripePaymentConfig
  paypal: PaypalPaymentConfig
}

export type EpisCloudModel = {
  id: string
  ownedBy?: string
}

export type EpisCloudModelsResult =
  | { status: 'ok'; models: EpisCloudModel[] }
  | { status: 'no-api-key' }
  | { status: 'error'; message: string }

export type UpdateProfileInput = {
  displayName?: string
  photoUrl?: string
  bio?: string
  coverImage?: string
  dateOfBirth?: string
}

export type CurrentUserResult = {
  user: AuthUserSummary | null
}

export type LoginSuccess = {
  ok: true
  user: AuthUserSummary
  redirectTo: '/dashboard'
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
  | 'oauth-exchange-failed'
  | 'oauth-profile-fetch-failed'
  | 'handoff-code-missing'
  | 'handoff-login-failed'
  | 'episcloud-activation-failed'
  | 'episcloud-not-activated'
  | 'episcloud-api-key-failed'
  | 'episcloud-models-failed'
  | 'payment-config-failed'
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
