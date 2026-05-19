import { createFileRoute, redirect } from '@tanstack/react-router'
import { startOAuthLoginFn } from '@/server/functions/oauth'

export const Route = createFileRoute('/auth/login')({
  loader: async () => {
    const { href } = await startOAuthLoginFn()
    throw redirect({ href })
  },
  component: LoginRoute,
})

function LoginRoute() {
  return null
}
