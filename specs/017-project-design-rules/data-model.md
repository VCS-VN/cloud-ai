# Data Model: Project Design Rules

## Project Design File

Represents the managed root `DESIGN.md` artifact for one retail storefront project.

**Fields**:
- `managedNotice`: Required notice that the file is generated and should be changed through chat.
- `designIntent`: Required structured intent for category, audience, price tier, archetype, mood, and deterministic seed.
- `tokens`: Required fixed token collection for Phase 1.
- `sections`: Required prose sections 1 through 8.

**Validation rules**:
- Must exist before customer-facing storefront UI generation.
- Must use the fixed section headings in order.
- Must contain a parseable structured token block.
- Must not contain raw user prompt text.
- Must not include token keys outside the fixed Phase 1 schema.
- Must pass required color and contrast validation.

**State transitions**:
- `missing` → `generated`: project initialization creates the file.
- `generated` → `patched`: token-specific design prompt updates relevant token values and guidance.
- `generated` or `patched` → `regenerated`: identity-level redesign updates the design direction.
- Any valid state → `invalid`: validation detects missing required structure, bad values, or failed contrast.

## Design Intent

Represents extracted or inferred design rationale for a retail storefront.

**Fields**:
- `category`: Retail category inferred or extracted from the prompt.
- `audience`: Target shoppers or buyer segment.
- `priceTier`: Retail positioning such as value, mid-market, premium, or luxury.
- `archetype`: Chosen visual direction.
- `mood`: Short list of atmosphere keywords.
- `seed`: Short deterministic fingerprint from project identity and normalized prompt.
- `source`: Whether intent came from initialization, patch, redesign, or fallback.

**Validation rules**:
- Must be present in every managed design file.
- Must contain only design-relevant extracted facts, not raw prompt text.
- Must be reflected in Section 1 rationale.

## Design Token

Represents a stable named visual role with a concrete value and provenance.

**Fields**:
- `name`: Stable Phase 1 token name.
- `value`: Concrete visual value for the token role.
- `provenance`: `user`, `agent`, `fallback-agent`, or `system`.
- `role`: Plain-language usage role.

**Validation rules**:
- Every required Phase 1 token must exist.
- Every token must have a value.
- Color tokens must be valid color values.
- Critical color pairs must meet 4.5:1 contrast.
- User-provided tokens must be preserved during redesign unless the current prompt conflicts.

## Token Mapping

Represents the generated bridge from design tokens to approved storefront UI utilities.

**Fields**:
- `sourceDesignHash`: Fingerprint of the design file content used to create the mapping.
- `semanticRoles`: Approved role names available to storefront UI.
- `generatedRegions`: Controlled areas owned by token generation.

**Validation rules**:
- Must be refreshed whenever design rules are created, patched, or regenerated.
- Must map shared semantic roles to design token values.
- Must not be hand-edited by UI-generation behavior outside controlled regions.

## Storefront UI Mutation

Represents a change to customer-facing retail UI.

**Fields**:
- `paths`: Changed storefront files or visual assets.
- `scope`: `changed-files` for normal updates or `full-storefront` for initialization, redesign, and explicit sync.
- `designRulesLoaded`: Whether current design rules were loaded during the run.
- `designHash`: Fingerprint of the loaded design rules.

**Validation rules**:
- Must be blocked if customer-facing UI paths are changed without loaded design rules.
- Must reject disallowed visual literals in scoped UI files.
- Must allow semantic token utilities mapped from the project design rules.

## Design Validation Result

Represents the outcome of design-file or UI compliance validation.

**Fields**:
- `status`: `passed`, `failed`, or `warning`.
- `scope`: Design file, changed UI files, or full storefront.
- `violations`: Repairable issues with file/path, value, and reason where applicable.
- `warnings`: Non-blocking concerns such as muted text contrast below preferred threshold.

**Validation rules**:
- Failed validation must include enough detail for the agent to repair the issue.
- Required validation failures block design acceptance or UI mutation acceptance.
