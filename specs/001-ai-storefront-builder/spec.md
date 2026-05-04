# Feature Specification: AI Storefront Builder

**Feature Branch**: `001-ai-storefront-builder`  
**Created**: 2026-05-04  
**Status**: Draft  
**Input**: User description: "Tính năng: AI Storefront Builder - Xây dựng hệ thống tạo website storefront bằng AI từ mô tả doanh nghiệp, sản phẩm, thương hiệu và yêu cầu thiết kế; hỗ trợ preview, chỉnh sửa, lưu, regenerate từng phần, export/publish, visibility cho admin/operator, validation structured output và kiến trúc module hóa."

## Clarifications

### Session 2026-05-04

- **Tech stack target**: V1 will be built as a TanStack Start application using server runtime capabilities. Persistent data will use PostgreSQL managed through Drizzle ORM. UI implementation will use Tailwind CSS and shadcn components, with the visual direction following the design system documented in `DESIGN.md`.
- **Persistence requirement**: V1 requires server-side persistence backed by PostgreSQL. Saved projects, generation records, validation results, product data, theme configuration, and export/publish state must survive application restarts and be reopenable for continued editing.
- **Preview/export target**: V1 output target is preview URL mode. A preview mode should create a stable, shareable preview route for a saved project or generated revision, render the storefront from persisted structured data, allow desktop/mobile review, and clearly distinguish draft preview from published storefront output. Static export and provider deployment remain future output providers.
- **Storefront schema approach**: V1 uses an extensible storefront schema that permits custom section types, while still requiring all sections to carry enough structured metadata for validation, safe rendering, editing, ordering, regeneration targeting, and fallback handling when a custom section cannot be rendered directly.
- **AI provider and secrets**: V1 requires one real AI provider integration behind a provider abstraction. Provider credentials and related secrets must be loaded from environment variables in `.env` files for local development and equivalent secret storage in deployed environments; `.env` files containing real secrets must not be committed, shown in UI, or logged.
- **Content safety gate**: The real AI provider output must pass schema validation, sanitization, and commercial/content safety checks before being persisted or rendered. Failed safety checks must preserve the previous valid project state and create an operator-visible validation record.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate a Storefront from a Natural Prompt (Priority: P1)

A shop owner or creator describes their business, target customers, brand voice, visual preferences, and product information in natural language, then receives a complete storefront preview generated from structured storefront data.

**Why this priority**: This is the core value of the product; without reliable generation and preview, no later editing or export flow is useful.

**Independent Test**: Can be fully tested by creating a new project from a complete business prompt and verifying that a previewable storefront with required pages, sections, products, theme, SEO metadata, warnings, and assumptions is produced.

**Acceptance Scenarios**:

1. **Given** a new user has no storefront project, **When** they submit a business prompt containing business name, industry, short description, target audience, brand voice, style preferences, and product descriptions, **Then** the system creates a project and generates structured storefront data with homepage, hero, product listing, product cards, brand/about, FAQ, CTA/contact, footer, theme suggestions, SEO title, and meta description.
2. **Given** the generated storefront data passes validation, **When** the user opens preview, **Then** the storefront renders from the structured data on desktop and mobile without hardcoded generated content.
3. **Given** the prompt omits optional product details, **When** generation completes, **Then** the storefront uses safe placeholders for missing fields and marks missing product data for user review.

---

### User Story 2 - Edit and Preserve Storefront Changes (Priority: P1)

A non-technical seller reviews the generated storefront and edits text, product details, theme settings, section order, and section presence while keeping changes saved in the project.

**Why this priority**: AI output is a starting point; users must be able to correct and personalize the storefront before publishing.

**Independent Test**: Can be fully tested by modifying generated copy, products, colors, typography, spacing, buttons, and section order, saving the project, reopening it, and verifying all changes remain intact.

**Acceptance Scenarios**:

1. **Given** a generated project is open, **When** the user edits section text, product data, and theme settings, **Then** the project state reflects the edits and the preview updates accordingly.
2. **Given** the user reorders, adds, removes, or restores sections, **When** the project is saved and reopened, **Then** the section structure and order match the last saved state.
3. **Given** a product lacks price, image, category, availability, or CTA label, **When** the user edits that product, **Then** the missing-data marker is removed only for fields the user has completed.

---

### User Story 3 - Regenerate Specific Storefront Parts Safely (Priority: P1)

A user asks AI to regenerate the whole storefront, one page, one section, copywriting only, layout only, or product descriptions only, without losing manual edits unless overwrite is explicitly requested.

**Why this priority**: Targeted regeneration reduces user effort and protects trust by preserving manual changes.

**Independent Test**: Can be fully tested by manually editing a generated section, regenerating a different section, and verifying the edited section remains unchanged; then regenerating the edited section with explicit overwrite and verifying the requested replacement occurs.

**Acceptance Scenarios**:

1. **Given** the user has manually edited a hero section, **When** they regenerate the FAQ section, **Then** the hero section remains unchanged and the generation history records only the FAQ regeneration.
2. **Given** the user requests copywriting-only regeneration for product cards, **When** generation succeeds, **Then** product card layout, product identifiers, prices, images, availability, and user-edited fields remain unchanged unless overwrite is selected.
3. **Given** regenerated AI output is invalid or incomplete, **When** validation fails, **Then** the existing project state remains unchanged and the user sees an actionable error.

---

### User Story 4 - Export or Publish a Previewable Storefront (Priority: P2)

A user finalizes a storefront and produces at least one usable output form such as static export, preview URL, deployable build output, or local generated website files.

**Why this priority**: Users need a tangible result beyond preview, but provider-specific publishing can evolve after the first release.

**Independent Test**: Can be fully tested by exporting or publishing a validated project and verifying the output renders the same storefront content and theme as preview.

**Acceptance Scenarios**:

1. **Given** a project has valid storefront data, **When** the user exports or publishes it, **Then** the system produces one supported output form and records export/publish status.
2. **Given** export or publish fails, **When** the user views the result, **Then** the project remains editable and the system shows a clear, actionable failure reason.

---

### User Story 5 - Operator Reviews Generation and Project State (Priority: P2)

An admin or operator inspects prompts, structured AI output, validation errors, generation history, current project state, and export/publish status without exposing secrets.

**Why this priority**: Operators need visibility to debug generation quality, validation failures, and user support issues.

**Independent Test**: Can be fully tested by generating valid and invalid outputs, then confirming operator views show prompts, outputs, validation errors, history, and state while masking all API keys and secrets.

**Acceptance Scenarios**:

1. **Given** a project has multiple generation records, **When** an operator reviews the project, **Then** they can see the original user prompt, each generation request scope, structured output, validation result, warnings, assumptions, and current project state.
2. **Given** any configuration contains secret values, **When** logs or operator views are inspected, **Then** secrets are never displayed in plain text.

### Edge Cases

- AI provider is unavailable, times out, rate-limits requests, or returns a non-actionable error.
- AI output is not valid structured data, violates required schema, includes unsupported section types, or omits required storefront fields.
- AI output includes unsafe commercial claims, fake reviews, fake guarantees, fake certifications, legal claims, or restricted product claims not supported by user input.
- User input is empty, too short, contradictory, extremely long, or contains unsafe content.
- Product data is incomplete, duplicated, malformed, has invalid price format, or lacks usable images.
- Regeneration targets a section or page that no longer exists because the user deleted or reordered it.
- Save, reopen, preview, export, or publish fails after generation succeeds.
- Mobile preview and desktop preview disagree in content or ordering.
- User edits conflict with newer regenerated content.
- Operator visibility must help debugging while never exposing API keys, tokens, or other secrets.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to create a storefront project from a natural-language business prompt.
- **FR-002**: A project MUST store project name, business profile, brand profile, product data, generated pages and sections, theme configuration, generation history, and export/publish status.
- **FR-003**: Users MUST be able to reopen a saved project and continue editing from the last saved state when project persistence is enabled for the release.
- **FR-004**: The system MUST generate structured storefront data rather than free-form text only.
- **FR-005**: Generated storefront data MUST include site title, tagline, hero section, value propositions, product sections, product cards, CTA copy, FAQ, footer, SEO title, and meta description.
- **FR-006**: Generated output MUST support pages, sections, products, theme suggestions, SEO metadata, warnings, and assumptions.
- **FR-007**: The system MUST validate generated output before applying it to project state.
- **FR-008**: Invalid or incomplete generated output MUST NOT crash the app or overwrite valid project state.
- **FR-009**: The system MUST show friendly, actionable errors for invalid user input, provider failures, schema validation failures, missing product data, save failures, and export/publish failures.
- **FR-010**: Storefront preview MUST render from structured project data and not from hardcoded generated content inside visual components.
- **FR-011**: Storefront preview MUST be responsive for desktop and mobile users.
- **FR-012**: Storefront pages, sections, and components MUST be reusable across generated projects.
- **FR-013**: Users MUST be able to edit generated text, product data, theme colors, typography, spacing, button style, section order, and section presence.
- **FR-014**: Users MUST be able to add, delete, reorder, and regenerate sections.
- **FR-015**: User edits MUST be saved and reflected in future previews and project reopen flows.
- **FR-016**: Users MUST be able to regenerate the whole storefront, a page, a section, copywriting only, layout only, or product descriptions only.
- **FR-017**: Regeneration MUST preserve manual edits unless the user explicitly requests overwrite for the targeted content.
- **FR-018**: Generation history MUST record original prompts, regeneration requests, target scope, structured output, validation result, warnings, assumptions, errors, and timestamps.
- **FR-019**: Each product MUST support name, description, price, image URL or placeholder image, category, availability, and CTA label.
- **FR-020**: Missing product information MUST use safe placeholders and be marked as incomplete until reviewed or edited by the user.
- **FR-021**: Product descriptions MUST be editable whether originally provided by the user or generated by AI.
- **FR-022**: The first release MUST support at least one output form: static export, preview URL, deployable build output, or local generated website files.
- **FR-023**: Export and publishing MUST be represented as replaceable provider capabilities so future output providers can be added without changing user-facing project data.
- **FR-024**: Admin/operator views MUST expose original prompts, structured AI output, validation errors, generation history, current project state, and export/publish status.
- **FR-025**: API keys, tokens, provider secrets, and sensitive configuration MUST NOT appear in user UI, operator UI, generated storefronts, or logs.
- **FR-026**: User input and AI output MUST be sanitized before rendering in preview or exported storefront output.
- **FR-027**: AI-generated content MUST avoid unsupported claims, fake reviews, fake guarantees, fake certifications, fake legal claims, and unsafe or prohibited commercial content.
- **FR-028**: Product claims MUST be cautious when input data is incomplete or unverified.
- **FR-029**: AI generation MUST support a non-blocking user experience with visible progress or loading state.
- **FR-030**: Section-level changes SHOULD avoid regenerating or re-rendering unrelated pages or sections where possible.
- **FR-031**: V1 MUST provide preview URL mode as its first output method, rendering a persisted project or revision as a stable draft preview route.
- **FR-032**: Preview mode MUST clearly indicate draft status and MUST NOT imply that the storefront is publicly published to a real domain.
- **FR-033**: Preview mode MUST support desktop and mobile review from the same structured storefront data used by the editor.
- **FR-034**: Custom section types MUST include validation metadata, editable content data, regeneration scope identifiers, and safe fallback behavior.
- **FR-035**: Real AI provider integration MUST be accessed through an abstraction that can be replaced without changing stored project data or rendering behavior.
- **FR-036**: Local provider keys MUST be read from `.env`-style environment files, while real secret values MUST be excluded from committed files and logs.

### Key Entities

- **StorefrontProject**: A saved storefront workspace containing project identity, business and brand profiles, product data, pages, sections, theme configuration, generation history, and export/publish state.
- **BusinessProfile**: Business name, industry, short description, target customers, brand voice, and source prompt context used to generate storefront content.
- **BrandProfile**: Style preferences, colors, typography preferences, tone, visual direction, and assumptions inferred during generation.
- **StorefrontPage**: A page within the storefront, such as homepage, containing ordered sections and SEO metadata.
- **StorefrontSection**: A reusable content block such as hero, product listing, product card group, brand/about, FAQ, contact/CTA, or footer, with editable content and layout metadata.
- **Product**: Sellable item data including name, description, price, image URL or placeholder, category, availability, CTA label, AI-generated fields, user-edited fields, and missing-data markers.
- **ThemeConfig**: Storefront appearance settings including colors, typography, spacing, button style, and layout preferences.
- **GenerationRecord**: Audit record of each generation or regeneration request, including prompt, scope, structured output, validation outcome, warnings, assumptions, errors, timestamps, and overwrite behavior.
- **ExportPublishState**: Current output status, selected output method, generated artifact reference, last attempt result, and failure reason if applicable.
- **ValidationResult**: Outcome of checking generated or edited data, including errors, warnings, safe fallbacks, and whether data may be applied to the project.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of valid first-time business prompts produce a previewable storefront without manual correction of required fields.
- **SC-002**: Users can complete the flow from new project prompt to rendered preview in under 5 minutes, excluding external AI provider delays longer than normal operating conditions.
- **SC-003**: 100% of invalid generated outputs are rejected safely without crashing the app or overwriting the last valid project state.
- **SC-004**: Users can regenerate a single section while preserving unrelated manual edits in 100% of tested regeneration cases.
- **SC-005**: Storefront preview displays equivalent content and section order on desktop and mobile in 100% of supported preview checks.
- **SC-006**: Users can export or publish a valid storefront through at least one supported output method with a clear success or failure status.
- **SC-007**: Operators can inspect prompt, structured output, validation errors, generation history, and current project state for 100% of generated projects while secrets remain hidden.
- **SC-008**: Required test coverage exists for schema validation, AI output parsing, rendering from valid project data, product model behavior, invalid AI output handling, preserving user edits during regeneration, and the create-generate-preview flow.

## Assumptions

- The first release targets a single storefront per project and a single merchant or creator, not multi-vendor marketplace workflows.
- Checkout, payment processing, complex inventory management, full CMS functionality, and required real-domain publishing are outside the first release.
- The first release uses one real configured AI provider internally, but provider access is abstracted so it can be replaced later without redesigning project data or user workflows.
- Preview URL mode is the first release output mechanism; static export and deployment providers are future extensions.
- Persistence is required for saved projects through a server-side PostgreSQL data store.
- Local development uses `.env`-style files for provider keys and database connection settings, with committed examples containing placeholders only.
- Product images may be supplied as URLs or represented with safe placeholder images when missing.
- Admin/operator access is intended for trusted maintainers and support users, not public storefront visitors.
- Generated storefront content is reviewed through validation and safety checks, but users remain responsible for final business accuracy before publication.
