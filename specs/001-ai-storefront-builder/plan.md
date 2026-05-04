# Implementation Plan: AI Storefront Builder

**Branch**: `001-ai-storefront-builder` | **Date**: 2026-05-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-ai-storefront-builder/spec.md`

## Summary

Build an AI Storefront Builder that lets users create a persisted storefront project from natural language, generate structured storefront data with a real AI provider, validate and sanitize output before persistence/rendering, preview the storefront through stable draft preview URLs, edit content/theme/products/sections, and keep operator-visible generation history. The implementation will start as a single TanStack Start application with server runtime routes/actions, PostgreSQL persistence through Drizzle ORM, Tailwind CSS + shadcn UI components, and the visual direction from `DESIGN.md`.

## Current Repository Structure

The repository is a new project and currently contains planning/design artifacts only:

```text
.
├── AGENTS.md
├── DESIGN.md
├── specs/
│   └── 001-ai-storefront-builder/
│       ├── checklists/
│       │   └── requirements.md
│       └── spec.md
└── .specify/
    ├── templates/
    ├── scripts/
    ├── extensions/
    └── feature.json
```

There is no existing application source tree, `package.json`, database schema, tests, routes, or component convention yet. The implementation should therefore establish the minimum TanStack Start convention needed for the feature while keeping module boundaries explicit and testable.

## Technical Context

**Language/Version**: TypeScript on current stable Node.js LTS supported by TanStack Start  
**Primary Dependencies**: TanStack Start, React, Tailwind CSS, shadcn UI, Drizzle ORM, PostgreSQL driver, schema validation library already chosen during implementation if present in scaffold; otherwise use the smallest necessary typed validation dependency  
**Storage**: PostgreSQL via Drizzle ORM migrations/schema  
**Testing**: TypeScript unit/integration tests using the project test runner selected by scaffold conventions; prefer one runner for schema/services/render tests  
**Target Platform**: Server-rendered web application with server runtime and browser storefront preview  
**Project Type**: Single full-stack web application  
**Performance Goals**: Preview should render from persisted data without waiting on AI generation; section regeneration should not trigger full storefront regeneration; normal editor/preview navigation should feel immediate for small-shop projects  
**Constraints**: Do not hardcode generated AI content in UI components; do not commit real `.env` secrets; validate and sanitize AI output before persistence or render; avoid provider-specific coupling outside AI adapter; avoid additional dependencies unless required for TanStack Start, Drizzle, validation, or tests  
**Scale/Scope**: V1 supports single-merchant storefront projects with homepage-centric storefronts, extensible sections, real AI generation, server persistence, preview URL output, and operator debugging views; checkout/payment/inventory/full CMS/static export/real deployment providers are out of scope

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The current constitution file still contains placeholder principles and no enforceable project-specific gates. For this plan, the effective gates come from the feature spec and user rules:

- **Modularity Gate**: AI generation, schema validation, rendering, editing, persistence, and preview/export must be separate modules/services.
- **Typed Schema Gate**: Storefront data and AI output must use typed schemas before persistence/rendering.
- **Safety Gate**: AI output must pass validation, sanitization, and content-safety checks before replacing project state.
- **Secret Gate**: Real provider keys and database credentials must use environment variables and must not be committed, logged, or shown in UI.
- **Minimal Dependency Gate**: Add only dependencies required for TanStack Start, Drizzle/Postgres, Tailwind/shadcn, validation, and tests.
- **Testability Gate**: Core schema, parsing, merge/regeneration, persistence, and rendering logic must be testable without a live AI call.

Initial gate status: PASS with the architecture below. Re-check after Phase 1 design: PASS; module boundaries, provider adapter, schema contracts, and preview output are documented in generated artifacts.

## Proposed Module Structure

### Documentation (this feature)

```text
specs/001-ai-storefront-builder/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── ai-provider.md
│   ├── service-contracts.md
│   └── storefront-schema.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
.
├── app/
│   ├── routes/
│   │   ├── index.tsx
│   │   ├── projects.tsx
│   │   ├── projects.$projectId.tsx
│   │   ├── projects.$projectId.admin.tsx
│   │   └── preview.$previewToken.tsx
│   ├── components/
│   │   ├── editor/
│   │   ├── storefront/
│   │   └── ui/
│   ├── styles/
│   │   └── globals.css
│   └── server/
│       ├── actions/
│       └── loaders/
├── src/
│   ├── ai/
│   │   ├── ai-provider.ts
│   │   ├── prompt-builder.ts
│   │   ├── real-provider.ts
│   │   └── generation-service.ts
│   ├── db/
│   │   ├── client.ts
│   │   ├── schema.ts
│   │   └── migrations/
│   ├── storefront/
│   │   ├── schema.ts
│   │   ├── validation.ts
│   │   ├── sanitization.ts
│   │   ├── safety.ts
│   │   ├── merge-user-edits.ts
│   │   └── defaults.ts
│   ├── projects/
│   │   ├── project-repository.ts
│   │   ├── project-service.ts
│   │   └── preview-service.ts
│   ├── rendering/
│   │   ├── section-registry.tsx
│   │   ├── StorefrontRenderer.tsx
│   │   └── fallback-section.tsx
│   ├── editing/
│   │   ├── edit-operations.ts
│   │   ├── edit-state.ts
│   │   └── section-operations.ts
│   └── export/
│       ├── output-provider.ts
│       └── preview-url-provider.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── drizzle.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── components.json
├── .env.example
└── .gitignore
```

**Structure Decision**: Use a single TanStack Start app because the repo is new and V1 needs one full-stack product surface. Place route/UI code under `app/` and testable domain modules under `src/`. Keep persistence, AI, validation, rendering, editing, and preview output in separate folders to prevent UI components from owning business logic.

## Data Models / Schemas

- **StorefrontProject**: `id`, `name`, `businessProfile`, `brandProfile`, `products`, `pages`, `theme`, `generationHistory`, `exportPublishState`, timestamps, and current revision/version.
- **BusinessProfile**: business name, industry, description, target audience, brand voice, original prompt summary.
- **BrandProfile**: style keywords, desired colors, tone, typography preferences, assumptions.
- **StorefrontPage**: `id`, `slug`, `title`, SEO metadata, ordered section ids/objects.
- **StorefrontSection**: extensible discriminated schema with common fields (`id`, `type`, `title`, `content`, `layout`, `editableFields`, `regenerationScope`, `source`, `updatedBy`) plus custom-section payload support.
- **Product**: name, description, price, image URL or placeholder, category, availability, CTA label, missing fields, source/edit metadata.
- **ThemeConfig**: color tokens, typography tokens, spacing, radius, buttons, layout preferences based on `DESIGN.md` defaults but editable per project.
- **GenerationRecord**: prompt, provider name/model, request scope, overwrite policy, raw structured output reference, validation result, warnings, assumptions, errors, duration, timestamp.
- **ExportPublishState**: preview token/url, output method, revision id, status, last success/failure, timestamps.
- **ValidationResult**: valid flag, errors, warnings, normalized fallback data, blocked safety findings.

Detailed fields and lifecycle rules are in `data-model.md` and `contracts/storefront-schema.md`.

## AI Provider Interface

- Define `AIProvider` as the only integration point for model calls.
- Inputs: normalized generation request, business/product/theme context, target scope, existing project state, overwrite policy, and safety constraints.
- Output: structured JSON candidate matching the storefront schema plus warnings/assumptions.
- Real provider adapter reads `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, optional base URL, and provider-specific settings from environment variables.
- The generation service owns prompt construction, provider invocation, parsing, validation, safety checks, generation record creation, and merge behavior.
- Tests use deterministic fakes at the provider interface boundary; live provider tests are optional/manual and never required for CI.

## Rendering Strategy

- Render storefront preview from `StorefrontProject` structured data only.
- Use a `section-registry` mapping section type to reusable storefront components.
- For custom section types, validate the payload and render either a generic custom-section component or a safe fallback that preserves content without executing unsafe markup/scripts.
- Keep renderer read-only; all edits flow through editing services and persisted project state.
- Apply `ThemeConfig` through CSS variables/Tailwind token mapping derived from `DESIGN.md` and project overrides.
- Preview URL route loads persisted project revision by token, displays a draft indicator, and supports desktop/mobile responsive layout.

## Editing Strategy

- Represent user edits as explicit operations: update text field, update product, update theme token, add section, delete section, reorder section, regenerate scope, overwrite target.
- Track edited fields or source metadata so regeneration can preserve manual edits by default.
- Section regeneration merges validated AI output into only the requested scope.
- Conflicts are resolved conservatively: user-edited fields win unless overwrite is explicit.
- Editor UI calls service actions; UI components should not directly mutate persisted schema.

## Persistence Strategy

- PostgreSQL is required for V1 persistence.
- Drizzle schema stores normalized project metadata plus JSON structured storefront snapshots where practical for MVP speed.
- Recommended tables: `storefront_projects`, `generation_records`, `project_revisions`, `preview_tokens`; optional separate `products` table if product querying/filtering is needed early.
- Save every accepted generation/edit as a project revision to support stable preview URLs and operator inspection.
- Keep raw provider output or parsed structured output available to operators, but never store or display provider secrets.
- `.env.example` documents `DATABASE_URL`, `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, and optional provider base URL with placeholder values only.

## Export / Publishing Strategy

- V1 output provider is `PreviewUrlProvider`.
- Preview mode creates or reuses a token for a project revision, exposes `/preview/$previewToken`, and renders a draft storefront from persisted data.
- Preview status is recorded as export/publish state but labeled as draft preview, not public domain publish.
- Future providers implement the same `OutputProvider` interface for static export, deployable build output, or real hosting deployment.
- Preview URLs should be stable per revision; regenerating or editing creates a new revision and can either update the active preview token or create a new token depending on product decision during tasks.

## Test Strategy

- **Unit**: storefront schema validation, AI output parsing, sanitizer, content-safety checks, product defaults/missing fields, edit operations, merge-user-edits behavior, provider interface fakes.
- **Rendering**: render storefront from valid project data, custom section fallback, mobile/desktop content equivalence at component level.
- **Persistence**: repository tests for create project, save revision, load project, generation record, preview token lifecycle.
- **Integration**: create project -> fake AI generation -> validate -> persist -> preview loader returns renderable project data.
- **E2E**: create project from prompt -> generate storefront -> open preview URL -> verify core sections render and draft preview indicator appears.
- **Safety regression**: invalid schema, unsafe claims, fake reviews/guarantees, malformed product data, and provider failure must preserve previous valid project state.
- Live AI provider tests should be opt-in with environment variables and skipped by default when keys are absent.

## Implementation Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Extensible custom sections are too loose | Invalid or unrenderable AI output reaches preview | Require common section metadata, schema validation, fallback renderer, and safety checks |
| Real AI provider dependency slows or blocks local tests | CI and local development become flaky | Use provider interface fakes for automated tests; keep live tests opt-in |
| Preview URL semantics blur with publishing | Users may mistake draft preview for live storefront | Show draft indicator and store preview as a distinct output provider/status |
| JSON snapshot persistence becomes hard to query | Admin/product filtering may need more structure later | Normalize metadata/history now; split products/sections later only when query needs appear |
| Manual edits lost during regeneration | User trust is damaged | Track edited fields/source metadata and default merge policy to preserve user edits |
| Secret leakage through logs/operator views | Security incident | Centralize env loading, redact secret-like fields, and test log/operator serialization |
| Content safety false negatives | Unsafe claims published in preview | Add rule-based validation for prohibited claims and record blocked findings before render |
| New repo dependency sprawl | Maintenance complexity | Add dependencies only when tasks require them and document rationale in implementation notes |

## Complexity Tracking

No constitution violations are identified. The plan intentionally uses a single app, one database, one AI provider adapter behind an interface, and preview URL mode only for V1.
