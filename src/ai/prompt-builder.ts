import type { GenerationRequest } from './ai-provider'

export function buildStorefrontPrompt(request: GenerationRequest): string {
  return JSON.stringify({ task: 'generate-storefront', scope: request.scope, businessProfile: request.businessProfile, brandProfile: request.brandProfile, products: request.products, overwrite: request.overwrite })
}
