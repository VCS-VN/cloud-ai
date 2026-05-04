import type { Product, PwaConfig, StorefrontProject, ThemeConfig } from './types'

export const placeholderImage = 'https://placehold.co/800x600?text=Product+Image'

export const designThemeDefaults: ThemeConfig = {
  colors: { primary: '#000000', canvas: '#ffffff', ink: '#000000', lime: '#dceeb1', lilac: '#c5b0f4', cream: '#f4ecd6' },
  typography: { display: 'figmaSans', body: 'figmaSans', mono: 'figmaMono' },
  spacing: { section: '96px', lg: '24px', md: '16px' },
  radius: { pill: '50px', lg: '24px', md: '8px' },
  buttonStyle: { shape: 'pill', weight: 'solid' },
  layoutDensity: 'comfortable',
  customTokens: {}
}

export function normalizeProduct(product: Partial<Product> & { id?: string; name?: string }): Product {
  const missingFields: string[] = [...(product.missingFields ?? [])]
  const mark = (field: string) => { if (!missingFields.includes(field)) missingFields.push(field) }
  if (!product.name) mark('name')
  if (!product.description) mark('description')
  if (!product.price) mark('price')
  if (!product.category) mark('category')
  if (!product.ctaLabel) mark('ctaLabel')
  if (!product.imageUrl && !product.placeholderImage) mark('image')
  return {
    id: product.id ?? crypto.randomUUID(),
    name: product.name || 'Untitled product',
    description: product.description || 'Product description pending review.',
    price: product.price || 'Price unavailable',
    imageUrl: product.imageUrl,
    placeholderImage: product.placeholderImage || placeholderImage,
    category: product.category || 'Uncategorized',
    availability: product.availability || 'unknown',
    ctaLabel: product.ctaLabel || 'Learn more',
    missingFields,
    source: product.source || 'ai',
    editedFields: product.editedFields || []
  }
}


export function deriveDefaultPwaConfig(project: Pick<StorefrontProject, 'name' | 'tagline' | 'businessProfile' | 'theme'>): PwaConfig {
  const appName = project.businessProfile.businessName || project.name
  return {
    enabled: true,
    name: appName,
    shortName: appName.slice(0, 24) || 'Storefront',
    description: project.tagline || project.businessProfile.shortDescription,
    themeColor: project.theme.colors.primary ?? '#000000',
    backgroundColor: project.theme.colors.canvas ?? '#ffffff',
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
