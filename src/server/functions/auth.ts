import { createServerFn } from '@tanstack/react-start'
import { toSafeAuthError } from '@/auth/auth-errors'

async function loadAuthService() {
  const { getAuthService } = await import('@/auth/auth-service')
  return getAuthService()
}

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

export const getPaymentConfig = createServerFn({ method: 'POST' }).handler(async () =>
  (await loadAuthService()).getPaymentConfig()
)

export const listPaymentMethods = createServerFn({ method: 'GET' }).handler(async () =>
  (await loadAuthService()).listPaymentMethods()
)

export const getBalanceSummary = createServerFn({ method: 'GET' }).handler(async () =>
  (await loadAuthService()).getBalanceSummary()
)

type TopupInput = {
  amountMicroUsd: number
  reason: string
  paymentMethodId?: string
}

export const topupBalance = createServerFn({ method: 'POST' })
  .inputValidator((data: TopupInput) => data)
  .handler(async ({ data }) =>
    (await loadAuthService()).topupBalance({
      amountMicroUsd: data.amountMicroUsd,
      reason: data.reason,
      paymentMethodId: data.paymentMethodId
    })
  )

export const listEpisCloudModels = createServerFn({ method: 'GET' }).handler(async () =>
  (await loadAuthService()).listEpisCloudModels()
)

export async function requireServerUser() {
  return (await loadAuthService()).requireActionUser().catch((error) => {
    throw toSafeAuthError(error, 'unauthorized')
  })
}
