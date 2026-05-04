# Contract: AI Provider Interface

## Purpose

Keep AI provider access replaceable while supporting one real provider in V1.

## Environment Configuration

Required local variables:
- `AI_PROVIDER`: provider id
- `AI_MODEL`: model id
- `AI_API_KEY`: provider secret

Optional variables:
- `AI_BASE_URL`: custom endpoint when provider supports it
- `AI_TIMEOUT_MS`: request timeout

Real values belong in uncommitted `.env` files or deployed secret storage. `.env.example` contains placeholders only.

## Interface

```ts
type GenerationScope =
  | { kind: 'storefront' }
  | { kind: 'page'; pageId: string }
  | { kind: 'section'; pageId: string; sectionId: string }
  | { kind: 'copywriting'; targetIds: string[] }
  | { kind: 'layout'; targetIds: string[] }
  | { kind: 'product-descriptions'; productIds: string[] }

type GenerationRequest = {
  projectId?: string
  businessProfile: BusinessProfile
  brandProfile: BrandProfile
  products: Product[]
  currentProject?: StorefrontProject
  scope: GenerationScope
  overwrite: boolean
  safetyPolicy: ContentSafetyPolicy
}

type GenerationCandidate = {
  structuredOutput: unknown
  warnings: string[]
  assumptions: string[]
  providerMetadata: Record<string, unknown>
}

interface AIProvider {
  generateStorefront(request: GenerationRequest): Promise<GenerationCandidate>
}
```

## Required Behavior

- Provider adapters return structured candidates only; they do not persist or render.
- Provider adapters must not log prompts with secrets or environment values.
- Parsing, schema validation, safety checks, persistence, and merge behavior happen outside the provider adapter in generation service.
- Automated tests use fake providers implementing the same interface.
