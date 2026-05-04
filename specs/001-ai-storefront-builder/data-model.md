# Data Model: AI Storefront Builder

## StorefrontProject

**Purpose**: Saved workspace for a generated storefront.

**Fields**:
- `id`: stable project identifier
- `name`: user-visible project name
- `businessProfile`: BusinessProfile
- `brandProfile`: BrandProfile
- `products`: Product[]
- `pages`: StorefrontPage[]
- `theme`: ThemeConfig
- `generationHistory`: GenerationRecord[] or relation
- `exportPublishState`: ExportPublishState
- `currentRevisionId`: latest accepted revision
- `createdAt`, `updatedAt`

**Rules**:
- Must have at least one page for preview.
- Must not apply invalid AI output to current revision.
- Saved projects must be reopenable after application restart.

## BusinessProfile

**Fields**: `businessName`, `industry`, `shortDescription`, `targetAudience`, `brandVoice`, `sourcePrompt`, `missingFields`.

**Rules**:
- `businessName` and meaningful description are required for generation.
- Missing optional fields may be represented as warnings/assumptions.

## BrandProfile

**Fields**: `styleKeywords`, `preferredColors`, `typographyPreference`, `tone`, `designNotes`, `assumptions`.

**Rules**:
- Defaults should align with `DESIGN.md` when user input does not override style.

## StorefrontPage

**Fields**: `id`, `slug`, `title`, `seo`, `sections`, `createdAt`, `updatedAt`.

**Rules**:
- `slug` must be unique inside a project.
- Homepage is required for V1.
- Section order is the source of truth for preview order.

## StorefrontSection

**Common fields**: `id`, `type`, `title`, `content`, `layout`, `editableFields`, `regenerationScope`, `source`, `updatedBy`, `createdAt`, `updatedAt`.

**Custom section support**:
- `type` may be a known renderer type or a custom type.
- Custom sections must include renderable `content` blocks and safe fallback metadata.
- Unknown/custom content must not include executable scripts or unsafe markup.

**Rules**:
- Every section must be targetable for edit, reorder, delete, and regeneration.
- User-edited fields win over regenerated values unless overwrite is explicit.

## Product

**Fields**: `id`, `name`, `description`, `price`, `imageUrl`, `placeholderImage`, `category`, `availability`, `ctaLabel`, `missingFields`, `source`, `editedFields`.

**Rules**:
- Missing product data uses safe placeholders and appears in `missingFields`.
- Product claims must not exceed provided or validated product information.

## ThemeConfig

**Fields**: `colors`, `typography`, `spacing`, `radius`, `buttonStyle`, `layoutDensity`, `customTokens`.

**Rules**:
- Defaults derive from `DESIGN.md` tokens.
- Project theme overrides must be sanitizable and safe to map to CSS variables.

## GenerationRecord

**Fields**: `id`, `projectId`, `revisionId`, `provider`, `model`, `prompt`, `scope`, `overwritePolicy`, `structuredOutput`, `validationResult`, `warnings`, `assumptions`, `errors`, `durationMs`, `createdAt`.

**Rules**:
- Records must exist for initial generation and every regeneration attempt.
- Failed validation or safety checks must be visible to operators.
- Secrets must never be stored in this record.

## ExportPublishState

**Fields**: `method`, `status`, `previewToken`, `previewUrl`, `revisionId`, `lastSuccessAt`, `lastFailureAt`, `failureReason`.

**Rules**:
- V1 method is `preview-url`.
- Preview status must be clearly distinguished from live publishing.

## ValidationResult

**Fields**: `valid`, `errors`, `warnings`, `blockedSafetyFindings`, `normalizedData`, `fallbacksApplied`.

**Rules**:
- Invalid results cannot update current project state.
- Warnings and assumptions can be persisted for operator review.

## Suggested Database Tables

- `storefront_projects`: project metadata, business profile, brand profile, current revision, export state summary.
- `project_revisions`: structured storefront snapshot, theme, products, pages, revision metadata.
- `generation_records`: prompt/output/validation/safety history.
- `preview_tokens`: stable token, project id, revision id, status, timestamps.

## State Transitions

```text
Draft prompt -> Generating -> Validation pending -> Validated -> Preview ready
Draft prompt -> Generating -> Validation failed -> Previous valid state preserved
Preview ready -> Editing -> Saved revision -> Preview ready
Preview ready -> Regenerating scope -> Validated merge -> Preview ready
Preview ready -> Regenerating scope -> Validation failed -> Preview ready with previous revision
```
