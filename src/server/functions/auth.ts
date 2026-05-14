import { createServerFn } from '@tanstack/react-start'
import { toSafeAuthError } from '@/auth/auth-errors'

async function loadAuthService() {
  const { getAuthService } = await import('@/auth/auth-service')
  return getAuthService()
}

export const loginWithOAuthCode = createServerFn({ method: 'POST' })
  .inputValidator((data: { code?: string; state?: string; codeVerifier?: string; redirectUri?: string }) => data)
  .handler(async ({ data }) =>
    (await loadAuthService()).signInWithOAuthCode({
      code: data.code ?? '',
      state: data.state ?? '',
      codeVerifier: data.codeVerifier ?? '',
      redirectUri: data.redirectUri ?? ''
    })
  )

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () => ({
  user: await (await loadAuthService()).getCurrentUser()
}))

export const logout = createServerFn({ method: 'POST' }).handler(async () => (await loadAuthService()).logout())

export async function requireServerUser() {
  return (await loadAuthService()).requireActionUser().catch((error) => {
    throw toSafeAuthError(error, 'unauthorized')
  })
}
