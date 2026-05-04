import type { AIProvider, GenerationRequest } from './ai-provider'
import { parseStructuredOutput } from './output-parser'
import { validateAIOutput } from '../storefront/validation'
import type { StorefrontAIOutput, StorefrontProject, ValidationResult } from '../storefront/types'

export type GenerationServiceResult = { applied: boolean; output?: StorefrontAIOutput; validation: ValidationResult; record: { warnings: string[]; assumptions: string[]; errors: string[] } }

export class GenerationService {
  constructor(private readonly provider: AIProvider) {}
  async generate(request: GenerationRequest): Promise<GenerationServiceResult> {
    try {
      const candidate = await this.provider.generateStorefront(request)
      const parsed = parseStructuredOutput(candidate.structuredOutput)
      const validation = validateAIOutput(parsed)
      if (!validation.valid) return { applied: false, validation, record: { warnings: candidate.warnings, assumptions: candidate.assumptions, errors: validation.errors.concat(validation.blockedSafetyFindings) } }
      return { applied: true, output: validation.normalizedData as StorefrontAIOutput, validation, record: { warnings: candidate.warnings, assumptions: candidate.assumptions, errors: [] } }
    } catch (error) {
      return { applied: false, validation: { valid: false, errors: [(error as Error).message], warnings: [], blockedSafetyFindings: [], fallbacksApplied: [] }, record: { warnings: [], assumptions: [], errors: [(error as Error).message] } }
    }
  }
  async regenerateSection(request: GenerationRequest): Promise<GenerationServiceResult> { return this.generate(request) }
}

export function createProjectFromOutput(id: string, output: StorefrontAIOutput): StorefrontProject {
  const now = new Date().toISOString()
  return { id, name: output.siteTitle, siteTitle: output.siteTitle, tagline: output.tagline, businessProfile: output.businessProfile, brandProfile: output.brandProfile, products: output.products, pages: output.pages, theme: output.theme, generationHistory: [], exportPublishState: { method: 'none', status: 'not-started' }, createdAt: now, updatedAt: now }
}
