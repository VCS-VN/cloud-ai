export type SourceKind = 'ai' | 'user' | 'mixed'
export type Availability = 'in-stock' | 'out-of-stock' | 'preorder' | 'unknown'

export type BusinessProfile = {
  businessName: string
  industry: string
  shortDescription: string
  targetAudience: string
  brandVoice: string
  sourcePrompt?: string
  missingFields: string[]
}

export type BrandProfile = {
  styleKeywords: string[]
  preferredColors: string[]
  typographyPreference?: string
  tone?: string
  designNotes?: string
  assumptions: string[]
}

export type SeoMetadata = { title: string; metaDescription: string }
export type EditableField = { path: string; label: string }
export type RegenerationScope = { pageId?: string; sectionId?: string; kind: string }

export type StorefrontSection = {
  id: string
  type: string
  title: string
  content: Record<string, unknown>
  layout: Record<string, unknown>
  editableFields: EditableField[]
  regenerationScope: RegenerationScope
  source: SourceKind
  updatedBy?: SourceKind
  createdAt?: string
  updatedAt?: string
}

export type StorefrontPage = {
  id: string
  slug: string
  title: string
  seo: SeoMetadata
  sections: StorefrontSection[]
  createdAt?: string
  updatedAt?: string
}

export type Product = {
  id: string
  name: string
  description: string
  price: string
  imageUrl?: string
  placeholderImage?: string
  category: string
  availability: Availability
  ctaLabel: string
  missingFields: string[]
  source: SourceKind
  editedFields: string[]
}

export type ThemeConfig = {
  colors: Record<string, string>
  typography: Record<string, string>
  spacing: Record<string, string>
  radius: Record<string, string>
  buttonStyle: Record<string, string>
  layoutDensity?: 'compact' | 'comfortable' | 'spacious'
  customTokens: Record<string, string>
}

export type ValidationResult = {
  valid: boolean
  errors: string[]
  warnings: string[]
  blockedSafetyFindings: string[]
  normalizedData?: unknown
  fallbacksApplied: string[]
}

export type GenerationRecord = {
  id: string
  projectId: string
  revisionId?: string
  provider: string
  model: string
  prompt: string
  scope: GenerationScope
  overwritePolicy: boolean
  structuredOutput?: unknown
  validationResult: ValidationResult
  warnings: string[]
  assumptions: string[]
  errors: string[]
  durationMs?: number
  createdAt: string
}

export type PwaIcon = {
  src: string
  sizes: string
  type: string
  purpose?: 'any' | 'maskable' | 'monochrome'
}

export type PwaConfig = {
  enabled: boolean
  name: string
  shortName: string
  description?: string
  themeColor: string
  backgroundColor: string
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser'
  startUrl: string
  scope: string
  icons: PwaIcon[]
  offlineFallbackEnabled: boolean
}

export type ExportPublishState = {
  method: 'preview-url' | 'static-export' | 'deployable-build' | 'hosted-publish' | 'none'
  status: 'not-started' | 'draft-preview' | 'success' | 'failed'
  previewToken?: string
  previewUrl?: string
  revisionId?: string
  lastSuccessAt?: string
  lastFailureAt?: string
  failureReason?: string
}

export type StorefrontProject = {
  id: string
  name: string
  siteTitle: string
  tagline: string
  businessProfile: BusinessProfile
  brandProfile: BrandProfile
  products: Product[]
  pages: StorefrontPage[]
  theme: ThemeConfig
  generationHistory: GenerationRecord[]
  exportPublishState: ExportPublishState
  pwa: PwaConfig
  currentRevisionId?: string
  createdAt: string
  updatedAt: string
}

export type GenerationScope =
  | { kind: 'storefront' }
  | { kind: 'page'; pageId: string }
  | { kind: 'section'; pageId: string; sectionId: string }
  | { kind: 'copywriting'; targetIds: string[] }
  | { kind: 'layout'; targetIds: string[] }
  | { kind: 'product-descriptions'; productIds: string[] }

export type StorefrontAIOutput = {
  siteTitle: string
  tagline: string
  businessProfile: BusinessProfile
  brandProfile: BrandProfile
  pages: StorefrontPage[]
  products: Product[]
  theme: ThemeConfig
  seo: SeoMetadata
  warnings: string[]
  assumptions: string[]
}
