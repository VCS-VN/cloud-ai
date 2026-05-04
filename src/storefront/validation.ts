import { aiOutputSchema, storefrontProjectSchema } from './schema'
import { normalizeProduct } from './defaults'
import { sanitizeDeep } from './sanitization'
import { findContentSafetyIssues } from './safety'
import type { StorefrontAIOutput, StorefrontProject, ValidationResult } from './types'

export function validateAIOutput(candidate: unknown): ValidationResult {
  const sanitized = sanitizeDeep(candidate)
  const safetyIssues = findContentSafetyIssues(sanitized)
  if (safetyIssues.length) return { valid: false, errors: [], warnings: [], blockedSafetyFindings: safetyIssues, fallbacksApplied: [] }
  const normalizedCandidate = normalizeCandidateProducts(sanitized)
  const parsed = aiOutputSchema.safeParse(normalizedCandidate)
  if (!parsed.success) return { valid: false, errors: parsed.error.issues.map((issue) => issue.message), warnings: [], blockedSafetyFindings: [], fallbacksApplied: [] }
  return { valid: true, errors: [], warnings: parsed.data.warnings, blockedSafetyFindings: [], normalizedData: parsed.data, fallbacksApplied: collectFallbacks(parsed.data) }
}

export function validateProject(project: unknown): ValidationResult {
  const parsed = storefrontProjectSchema.safeParse(sanitizeDeep(project))
  if (!parsed.success) return { valid: false, errors: parsed.error.issues.map((issue) => issue.message), warnings: [], blockedSafetyFindings: [], fallbacksApplied: [] }
  return { valid: true, errors: [], warnings: [], blockedSafetyFindings: [], normalizedData: parsed.data, fallbacksApplied: collectFallbacks(parsed.data) }
}

function normalizeCandidateProducts(candidate: unknown): unknown {
  if (!candidate || typeof candidate !== 'object' || !('products' in candidate) || !Array.isArray((candidate as { products: unknown }).products)) return candidate
  return { ...candidate, products: (candidate as { products: Array<Partial<StorefrontAIOutput['products'][number]>> }).products.map(normalizeProduct) }
}

function collectFallbacks(data: StorefrontAIOutput | StorefrontProject): string[] {
  return data.products.flatMap((product) => product.missingFields.map((field) => `product:${product.id}:${field}`))
}
