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

type ProfileInput = {
  displayName?: string
  bio?: string
  photoUrl?: string
  coverImage?: string
  dateOfBirth?: string
}

function normalize(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export const updateProfile = createServerFn({ method: 'POST' })
  .inputValidator((data: ProfileInput) => data)
  .handler(async ({ data }) =>
    (await loadAuthService()).updateProfile({
      displayName: normalize(data.displayName),
      bio: normalize(data.bio),
      photoUrl: normalize(data.photoUrl),
      coverImage: normalize(data.coverImage),
      dateOfBirth: normalize(data.dateOfBirth)
    })
  )

export const activateEpisCloud = createServerFn({ method: 'POST' }).handler(async () =>
  (await loadAuthService()).activateEpisCloud()
)

export async function requireServerUser() {
  return (await loadAuthService()).requireActionUser().catch((error) => {
    throw toSafeAuthError(error, 'unauthorized')
  })
}
