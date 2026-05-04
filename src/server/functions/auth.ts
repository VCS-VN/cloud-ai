import { createServerFn } from '@tanstack/react-start'
import { toSafeAuthError } from '@/auth/auth-errors'

async function loadAuthService() {
  const { getAuthService } = await import('@/auth/auth-service')
  return getAuthService()
}

export const loginWithFirebaseToken = createServerFn({ method: 'POST' })
  .inputValidator((data: { idToken?: string }) => data)
  .handler(async ({ data }) => (await loadAuthService()).signInWithFirebaseIdToken(data.idToken ?? ''))

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () => ({
  user: await (await loadAuthService()).getCurrentUser()
}))

export const logout = createServerFn({ method: 'POST' }).handler(async () => (await loadAuthService()).logout())

export async function requireServerUser() {
  return (await loadAuthService()).requireActionUser().catch((error) => {
    throw toSafeAuthError(error, 'unauthorized')
  })
}
