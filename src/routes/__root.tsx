import type { ReactNode } from 'react'
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { ThemeProvider } from '@/theme'
import '@app/styles/globals.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Cloud AI' },
      { name: 'theme-color', content: '#101216' },
      { name: 'application-name', content: 'Cloud AI' },
      { name: 'apple-mobile-web-app-title', content: 'Cloud AI' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
    ]
  }),
  component: RootComponent
})

function RootComponent() {
  return (
    <RootDocument>
      <ThemeProvider>
        <Outlet />
      </ThemeProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
