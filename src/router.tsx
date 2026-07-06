import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { AppErrorFallback } from '@/components/AppErrorFallback'

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultErrorComponent: AppErrorFallback
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
