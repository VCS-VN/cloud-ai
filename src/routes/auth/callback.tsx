import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/auth/callback')({
  beforeLoad: ({ search }) => {
    const params = new URLSearchParams(search as Record<string, string>)
    const query = params.toString()
    throw redirect({ href: `/api/auth/callback${query ? `?${query}` : ''}` })
  },
  component: CallbackRoute,
})

function CallbackRoute() {
  return null
}
