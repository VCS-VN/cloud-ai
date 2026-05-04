import type { Message, Project, ProjectFileNode, PwaConfig } from './types'

const seedTimestamp = '2026-05-04T00:00:00.000Z'

export function createDefaultPwaConfig(projectName: string, description?: string): PwaConfig {
  return {
    enabled: true,
    name: projectName,
    shortName: projectName.slice(0, 24) || 'Storefront',
    description,
    themeColor: '#000000',
    backgroundColor: '#ffffff',
    display: 'standalone',
    startUrl: '/',
    scope: '/',
    offlineFallbackEnabled: false,
    icons: [
      { src: '/assets/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/assets/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
    ]
  }
}

export function createSeedProject(overrides: Partial<Project> = {}): Project {
  const name = overrides.name ?? 'Luxury Heels Storefront'
  return {
    id: overrides.id ?? 'project-luxury-heels',
    name,
    description: overrides.description ?? 'Storefront sang trọng cho giày cao gót nữ công sở.',
    initialPrompt:
      overrides.initialPrompt ??
      'Tạo website bán giày cao gót phong cách sang trọng, màu đen vàng, dành cho khách hàng nữ công sở.',
    status: overrides.status ?? 'ready',
    createdAt: overrides.createdAt ?? seedTimestamp,
    updatedAt: overrides.updatedAt ?? seedTimestamp,
    pwa: overrides.pwa ?? createDefaultPwaConfig(name, overrides.description),
    ...overrides
  }
}

export function createSeedMessages(projectId = 'project-luxury-heels'): Message[] {
  return [
    {
      id: `${projectId}-message-user-initial`,
      projectId,
      role: 'user',
      content: 'Tạo website bán giày cao gót phong cách sang trọng, màu đen vàng, dành cho khách hàng nữ công sở.',
      status: 'completed',
      createdAt: seedTimestamp
    },
    {
      id: `${projectId}-message-agent-initial`,
      projectId,
      role: 'agent',
      content: 'Mình đã tạo bản nháp storefront với hero sang trọng, lưới sản phẩm nổi bật và cấu trúc PWA cơ bản.',
      status: 'completed',
      createdAt: '2026-05-04T00:00:01.000Z'
    }
  ]
}

export function createSeedFileTree(project: Project): ProjectFileNode[] {
  const now = project.updatedAt
  const rootId = `${project.id}-node-storefront`
  const assetsId = `${project.id}-node-assets`
  const iconsId = `${project.id}-node-icons`
  const srcId = `${project.id}-node-src`
  const sectionsId = `${project.id}-node-sections`
  const dataId = `${project.id}-node-data`

  const manifestContent = JSON.stringify(
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

  const baseNodes: ProjectFileNode[] = [
    folder(rootId, project.id, 'storefront', 'storefront', null, now),
    file(`${project.id}-node-index`, project.id, 'index.html', 'storefront/index.html', rootId, 'text/html', '<!doctype html>\n<html lang="vi">\n  <head></head>\n  <body>Generated storefront preview</body>\n</html>', now, { virtual: true, safePreview: false }),
    folder(srcId, project.id, 'src', 'storefront/src', rootId, now),
    folder(sectionsId, project.id, 'sections', 'storefront/src/sections', srcId, now),
    file(`${project.id}-node-hero`, project.id, 'Hero.tsx', 'storefront/src/sections/Hero.tsx', sectionsId, 'text/plain', 'Hero section: headline, subhead, CTA, luxury editorial styling.', now, { sectionType: 'hero', virtual: true }),
    file(`${project.id}-node-product-grid`, project.id, 'ProductGrid.tsx', 'storefront/src/sections/ProductGrid.tsx', sectionsId, 'text/plain', 'Product grid section: featured products, pricing, and CTA labels.', now, { sectionType: 'product-grid', virtual: true }),
    file(`${project.id}-node-faq`, project.id, 'FAQ.tsx', 'storefront/src/sections/FAQ.tsx', sectionsId, 'text/plain', 'FAQ section: shipping, sizing, and care guidance.', now, { sectionType: 'faq', virtual: true }),
    folder(dataId, project.id, 'data', 'storefront/src/data', srcId, now),
    file(`${project.id}-node-storefront-json`, project.id, 'storefront.json', 'storefront/src/data/storefront.json', dataId, 'application/json', JSON.stringify({ name: project.name, description: project.description, pwa: project.pwa }, null, 2), now, { virtual: true })
  ]

  if (!project.pwa.enabled) return baseNodes

  return [
    ...baseNodes.slice(0, 2),
    file(`${project.id}-node-manifest`, project.id, 'manifest.webmanifest', 'storefront/manifest.webmanifest', rootId, 'application/manifest+json', manifestContent, now, { virtual: true, pwa: true }),
    file(`${project.id}-node-service-worker`, project.id, 'service-worker.js', 'storefront/service-worker.js', rootId, 'text/javascript', '/* Safe MVP placeholder: cache static storefront shell only. Do not cache private API or user data. */', now, { virtual: true, pwa: true }),
    folder(assetsId, project.id, 'assets', 'storefront/assets', rootId, now),
    folder(iconsId, project.id, 'icons', 'storefront/assets/icons', assetsId, now),
    file(`${project.id}-node-icon-192`, project.id, 'icon-192.png', 'storefront/assets/icons/icon-192.png', iconsId, 'image/png', undefined, now, { virtual: true, placeholderIcon: true, sizes: '192x192' }),
    file(`${project.id}-node-icon-512`, project.id, 'icon-512.png', 'storefront/assets/icons/icon-512.png', iconsId, 'image/png', undefined, now, { virtual: true, placeholderIcon: true, sizes: '512x512' }),
    ...baseNodes.slice(2)
  ]
}

function folder(id: string, projectId: string, name: string, path: string, parentId: string | null, timestamp: string): ProjectFileNode {
  return { id, projectId, name, type: 'folder', path, parentId, createdAt: timestamp, updatedAt: timestamp }
}

function file(
  id: string,
  projectId: string,
  name: string,
  path: string,
  parentId: string,
  contentType: string,
  content: string | undefined,
  timestamp: string,
  metadata: Record<string, string | number | boolean | null>
): ProjectFileNode {
  return { id, projectId, name, type: 'file', path, parentId, contentType, content, metadata, createdAt: timestamp, updatedAt: timestamp }
}

export const seedProjects = [createSeedProject()]
export const seedMessages = createSeedMessages(seedProjects[0].id)
export const seedFileNodes = createSeedFileTree(seedProjects[0])
