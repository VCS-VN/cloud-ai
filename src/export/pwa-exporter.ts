import type { PwaIcon, StorefrontProject } from '@/storefront/types'

export type GeneratedPwaFile = {
  fileName: 'manifest.webmanifest' | 'service-worker.js'
  content: string
}

export type PwaAsset = PwaIcon

export function generatePwaManifest(project: StorefrontProject): GeneratedPwaFile | undefined {
  if (!project.pwa.enabled) return undefined

  return {
    fileName: 'manifest.webmanifest',
    content: JSON.stringify(
      {
        name: project.pwa.name,
        short_name: project.pwa.shortName,
        description: project.pwa.description,
        theme_color: project.pwa.themeColor,
        background_color: project.pwa.backgroundColor,
        display: project.pwa.display,
        start_url: project.pwa.startUrl,
        scope: project.pwa.scope,
        icons: project.pwa.icons
      },
      null,
      2
    )
  }
}

export function generateServiceWorker(project: StorefrontProject): GeneratedPwaFile | undefined {
  if (!project.pwa.enabled) return undefined

  return {
    fileName: 'service-worker.js',
    content: [
      '// Safe MVP service worker: cache static storefront shell only; never cache private API or user data.',
      'const STATIC_CACHE = "storefront-static-v1"',
      'const STATIC_ASSETS = ["/", "/manifest.webmanifest"]',
      'self.addEventListener("install", (event) => {',
      '  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)))',
      '})',
      'self.addEventListener("fetch", (event) => {',
      '  const url = new URL(event.request.url)',
      '  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/admin") || event.request.method !== "GET") return',
      '  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)))',
      '})'
    ].join('\n')
  }
}

export function collectPwaAssets(project: StorefrontProject): PwaAsset[] {
  return project.pwa.enabled ? project.pwa.icons : []
}
