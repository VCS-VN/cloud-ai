import { z } from 'zod'

export const sourceKindSchema = z.enum(['ai', 'user', 'mixed'])
export const availabilitySchema = z.enum(['in-stock', 'out-of-stock', 'preorder', 'unknown'])
export const seoMetadataSchema = z.object({ title: z.string().min(1), metaDescription: z.string().min(1) })

export const businessProfileSchema = z.object({
  businessName: z.string().min(1),
  industry: z.string().min(1),
  shortDescription: z.string().min(1),
  targetAudience: z.string().min(1),
  brandVoice: z.string().min(1),
  sourcePrompt: z.string().optional(),
  missingFields: z.array(z.string()).default([])
})

export const brandProfileSchema = z.object({
  styleKeywords: z.array(z.string()).default([]),
  preferredColors: z.array(z.string()).default([]),
  typographyPreference: z.string().optional(),
  tone: z.string().optional(),
  designNotes: z.string().optional(),
  assumptions: z.array(z.string()).default([])
})

export const productSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.string().min(1),
  imageUrl: z.string().url().optional(),
  placeholderImage: z.string().optional(),
  category: z.string().min(1),
  availability: availabilitySchema.default('unknown'),
  ctaLabel: z.string().min(1),
  missingFields: z.array(z.string()).default([]),
  source: sourceKindSchema.default('ai'),
  editedFields: z.array(z.string()).default([])
}).refine((product) => product.imageUrl || product.placeholderImage, { message: 'Product requires imageUrl or placeholderImage' })

export const editableFieldSchema = z.object({ path: z.string().min(1), label: z.string().min(1) })
export const regenerationScopeSchema = z.object({ pageId: z.string().optional(), sectionId: z.string().optional(), kind: z.string().min(1) })

export const sectionSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  content: z.record(z.string(), z.unknown()),
  layout: z.record(z.string(), z.unknown()).default({}),
  editableFields: z.array(editableFieldSchema).default([]),
  regenerationScope: regenerationScopeSchema,
  source: sourceKindSchema.default('ai'),
  updatedBy: sourceKindSchema.optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

export const pageSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  seo: seoMetadataSchema,
  sections: z.array(sectionSchema).min(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

export const themeConfigSchema = z.object({
  colors: z.record(z.string(), z.string()).default({}),
  typography: z.record(z.string(), z.string()).default({}),
  spacing: z.record(z.string(), z.string()).default({}),
  radius: z.record(z.string(), z.string()).default({}),
  buttonStyle: z.record(z.string(), z.string()).default({}),
  layoutDensity: z.enum(['compact', 'comfortable', 'spacious']).optional(),
  customTokens: z.record(z.string(), z.string()).default({})
})

export const validationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  blockedSafetyFindings: z.array(z.string()).default([]),
  normalizedData: z.unknown().optional(),
  fallbacksApplied: z.array(z.string()).default([])
})

export const generationScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('storefront') }),
  z.object({ kind: z.literal('page'), pageId: z.string() }),
  z.object({ kind: z.literal('section'), pageId: z.string(), sectionId: z.string() }),
  z.object({ kind: z.literal('copywriting'), targetIds: z.array(z.string()) }),
  z.object({ kind: z.literal('layout'), targetIds: z.array(z.string()) }),
  z.object({ kind: z.literal('product-descriptions'), productIds: z.array(z.string()) })
])

export const generationRecordSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  revisionId: z.string().optional(),
  provider: z.string().min(1),
  model: z.string().min(1),
  prompt: z.string().min(1),
  scope: generationScopeSchema,
  overwritePolicy: z.boolean(),
  structuredOutput: z.unknown().optional(),
  validationResult: validationResultSchema,
  warnings: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  errors: z.array(z.string()).default([]),
  durationMs: z.number().optional(),
  createdAt: z.string()
})

export const pwaIconSchema = z.object({
  src: z.string().min(1),
  sizes: z.string().min(1),
  type: z.string().min(1),
  purpose: z.enum(['any', 'maskable', 'monochrome']).optional()
})

export const pwaConfigSchema = z.object({
  enabled: z.boolean(),
  name: z.string().min(1),
  shortName: z.string().min(1),
  description: z.string().optional(),
  themeColor: z.string().min(1),
  backgroundColor: z.string().min(1),
  display: z.enum(['standalone', 'fullscreen', 'minimal-ui', 'browser']),
  startUrl: z.string().min(1),
  scope: z.string().min(1),
  icons: z.array(pwaIconSchema),
  offlineFallbackEnabled: z.boolean()
}).superRefine((config, context) => {
  if (!config.enabled) return
  if (config.icons.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['icons'], message: 'PWA icons are required when PWA is enabled' })
  }
})

export const exportPublishStateSchema = z.object({
  method: z.enum(['preview-url', 'static-export', 'deployable-build', 'hosted-publish', 'none']).default('none'),
  status: z.enum(['not-started', 'draft-preview', 'success', 'failed']).default('not-started'),
  previewToken: z.string().optional(),
  previewUrl: z.string().optional(),
  revisionId: z.string().optional(),
  lastSuccessAt: z.string().optional(),
  lastFailureAt: z.string().optional(),
  failureReason: z.string().optional()
})

export const storefrontProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  siteTitle: z.string().min(1),
  tagline: z.string().min(1),
  businessProfile: businessProfileSchema,
  brandProfile: brandProfileSchema,
  products: z.array(productSchema),
  pages: z.array(pageSchema).min(1),
  theme: themeConfigSchema,
  generationHistory: z.array(generationRecordSchema).default([]),
  exportPublishState: exportPublishStateSchema,
  pwa: pwaConfigSchema,
  currentRevisionId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const aiOutputSchema = z.object({
  siteTitle: z.string().min(1),
  tagline: z.string().min(1),
  businessProfile: businessProfileSchema,
  brandProfile: brandProfileSchema,
  pages: z.array(pageSchema).min(1),
  products: z.array(productSchema),
  theme: themeConfigSchema,
  seo: seoMetadataSchema,
  warnings: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([])
})

export type StorefrontProjectInput = z.infer<typeof storefrontProjectSchema>
export type StorefrontAIOutputInput = z.infer<typeof aiOutputSchema>
