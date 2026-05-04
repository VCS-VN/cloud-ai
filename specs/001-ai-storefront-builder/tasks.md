# Tasks: AI Storefront Builder

**Input**: Design documents from `specs/001-ai-storefront-builder/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Tests are required by the feature spec. Test tasks are placed before the implementation tasks they verify.

**Organization**: Tasks are grouped by foundation and user story, while preserving the requested implementation priority: schema, schema tests, AI provider interface, design/UI foundation, generation service, renderer, project creation, preview, editing, section regeneration, persistence, output provider, integration/error tests, README.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after phase prerequisites are complete
- **[Story]**: Which user story the task belongs to (`US1` generate/preview, `US2` editing, `US3` regeneration, `US4` preview output, `US5` operator visibility)
- Every task includes expected file/module scope and a verify/test command

## Phase 1: Setup (Project Initialization)

**Purpose**: Establish the minimum TanStack Start application scaffold and quality commands for later small tasks.

- [x] T001 Initialize TanStack Start TypeScript project scaffolding in `package.json`, `tsconfig.json`, `app/`, `src/`, and `tests/` (Verify: `pnpm build`)
- [x] T002 Configure Tailwind CSS and shadcn UI foundation in `tailwind.config.ts`, `postcss.config.*`, `app/styles/globals.css`, and `components.json` using `DESIGN.md` tokens (Verify: `pnpm lint`)
- [x] T003 Add environment and secret hygiene files in `.env.example` and `.gitignore` for `DATABASE_URL`, `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `AI_BASE_URL`, and `AI_TIMEOUT_MS` (Verify: `git check-ignore .env`)
- [x] T004 Configure test runner scripts in `package.json` and baseline test setup in `tests/setup.ts` (Verify: `pnpm test -- --run`)
- [x] T005 Configure Drizzle and PostgreSQL connection placeholders in `drizzle.config.ts` and `src/db/client.ts` without requiring a live DB for unit tests (Verify: `pnpm typecheck`)

**Checkpoint**: Project installs, typechecks, builds, and has a safe `.env` convention.

---

## Phase 2: Foundation - Schema, Validation, Persistence Contracts

**Purpose**: Define typed data contracts first so AI, rendering, editing, persistence, and preview all consume the same source of truth.

- [x] T006 [P] Define storefront project TypeScript domain types in `src/storefront/types.ts` from `data-model.md` (Verify: `pnpm typecheck`)
- [x] T007 [P] Define typed validation schemas for project, page, section, product, theme, generation record, and validation result in `src/storefront/schema.ts` (Verify: `pnpm typecheck`)
- [x] T008 [P] Add valid storefront fixture and invalid AI output fixtures in `tests/fixtures/storefront-project.ts` and `tests/fixtures/ai-output.ts` (Verify: `pnpm test -- --run tests/fixtures`)
- [x] T009 [P] Add unit tests for storefront schema validation in `tests/unit/storefront/schema.test.ts` (Verify: `pnpm test -- --run tests/unit/storefront/schema.test.ts`)
- [x] T010 [P] Add unit tests for product defaults and missing-field markers in `tests/unit/storefront/product.test.ts` (Verify: `pnpm test -- --run tests/unit/storefront/product.test.ts`)
- [x] T011 Implement validation normalization and safe product placeholders in `src/storefront/validation.ts` and `src/storefront/defaults.ts` (Verify: `pnpm test -- --run tests/unit/storefront/schema.test.ts tests/unit/storefront/product.test.ts`)
- [x] T012 [P] Implement sanitization helpers for user input and AI output in `src/storefront/sanitization.ts` with tests in `tests/unit/storefront/sanitization.test.ts` (Verify: `pnpm test -- --run tests/unit/storefront/sanitization.test.ts`)
- [x] T013 [P] Implement rule-based content safety checks for unsupported claims, fake reviews, fake guarantees, and restricted commercial claims in `src/storefront/safety.ts` with tests in `tests/unit/storefront/safety.test.ts` (Verify: `pnpm test -- --run tests/unit/storefront/safety.test.ts`)
- [x] T014 Define Drizzle tables for `storefront_projects`, `project_revisions`, `generation_records`, and `preview_tokens` in `src/db/schema.ts` (Verify: `pnpm typecheck`)
- [x] T015 Create repository interfaces for projects, revisions, generation records, and preview tokens in `src/projects/repositories.ts` (Verify: `pnpm typecheck`)
- [x] T016 Add repository contract tests using fake/in-memory implementations in `tests/unit/projects/repositories.test.ts` (Verify: `pnpm test -- --run tests/unit/projects/repositories.test.ts`)

**Checkpoint**: Typed schema, validation, safety, product behavior, and persistence contracts are independently testable.

---

## Phase 3: User Story 1 - Generate and Preview Storefront (Priority: P1)

**Goal**: A shop owner creates a project from a natural prompt and receives validated structured storefront data that can render in preview.

**Independent Test**: Create a project using a fake AI provider, validate structured output, persist a project revision, and render the storefront preview from structured data.

### Tests for User Story 1

- [x] T017 [P] [US1] Add AI provider interface contract tests with a fake provider in `tests/unit/ai/ai-provider.test.ts` (Verify: `pnpm test -- --run tests/unit/ai/ai-provider.test.ts`)
- [x] T018 [P] [US1] Add AI output parsing and invalid output tests in `tests/unit/ai/output-parser.test.ts` (Verify: `pnpm test -- --run tests/unit/ai/output-parser.test.ts`)
- [x] T019 [P] [US1] Add generation service tests for valid generation and validation failure in `tests/unit/ai/generation-service.test.ts` (Verify: `pnpm test -- --run tests/unit/ai/generation-service.test.ts`)
- [x] T020 [P] [US1] Add renderer tests for valid project data and custom section fallback in `tests/unit/rendering/storefront-renderer.test.tsx` (Verify: `pnpm test -- --run tests/unit/rendering/storefront-renderer.test.tsx`)
- [x] T021 [P] [US1] Add project creation flow integration test in `tests/integration/create-generate-preview.test.ts` (Verify: `pnpm test -- --run tests/integration/create-generate-preview.test.ts`)

### Implementation for User Story 1

- [x] T022 [P] [US1] Create AI provider interface and request/response types in `src/ai/ai-provider.ts` (Verify: `pnpm typecheck`)
- [x] T023 [US1] Implement real AI provider adapter with environment configuration and secret redaction in `src/ai/real-provider.ts` and `src/ai/env.ts` (Verify: `pnpm test -- --run tests/unit/ai/ai-provider.test.ts`)
- [x] T024 [P] [US1] Implement prompt builder for storefront and scoped generation requests in `src/ai/prompt-builder.ts` (Verify: `pnpm test -- --run tests/unit/ai/output-parser.test.ts`)
- [x] T025 [US1] Implement structured AI output parser in `src/ai/output-parser.ts` (Verify: `pnpm test -- --run tests/unit/ai/output-parser.test.ts`)
- [x] T026 [US1] Implement generation service validation pipeline in `src/ai/generation-service.ts` using parser, validation, sanitization, and safety modules (Verify: `pnpm test -- --run tests/unit/ai/generation-service.test.ts`)
- [x] T027 [P] [US1] Implement project repository backed by Drizzle in `src/projects/project-repository.ts` (Verify: `pnpm test -- --run tests/unit/projects/repositories.test.ts`)
- [x] T028 [US1] Implement project service for create-from-prompt and accepted revision persistence in `src/projects/project-service.ts` (Verify: `pnpm test -- --run tests/integration/create-generate-preview.test.ts`)
- [x] T029 [P] [US1] Implement storefront section registry and fallback section renderer in `src/rendering/section-registry.tsx` and `src/rendering/fallback-section.tsx` (Verify: `pnpm test -- --run tests/unit/rendering/storefront-renderer.test.tsx`)
- [x] T030 [US1] Implement `StorefrontRenderer` from typed schema in `src/rendering/StorefrontRenderer.tsx` (Verify: `pnpm test -- --run tests/unit/rendering/storefront-renderer.test.tsx`)
- [x] T031 [P] [US1] Build shadcn/Tailwind storefront components using `DESIGN.md` style tokens in `app/components/storefront/hero-section.tsx`, `app/components/storefront/product-listing.tsx`, `app/components/storefront/faq-section.tsx`, `app/components/storefront/cta-section.tsx`, and `app/components/storefront/footer-section.tsx` (Verify: `pnpm lint`)
- [x] T032 [P] [US1] Build project creation route and form in `app/routes/projects.tsx` and `app/components/editor/create-project-form.tsx` (Verify: `pnpm build`)
- [x] T033 [US1] Wire server action/loader for create project flow in `app/server/actions/create-project.ts` and `app/routes/projects.$projectId.tsx` (Verify: `pnpm test -- --run tests/integration/create-generate-preview.test.ts`)
- [x] T034 [US1] Run User Story 1 validation across typecheck, unit, integration, and build scripts (Verify: `pnpm typecheck && pnpm test -- --run && pnpm build`)

**Checkpoint**: Users can create a project from a prompt and render validated generated storefront data.

---

## Phase 4: User Story 2 - Edit and Preserve Storefront Changes (Priority: P1)

**Goal**: Users edit text, product data, theme settings, and section structure, then save and reopen those edits.

**Independent Test**: Modify generated copy, products, theme, and section order; save; reload project data; verify the preview reflects saved edits.

### Tests for User Story 2

- [x] T035 [P] [US2] Add edit operation unit tests for text, product, theme, section add/delete/reorder in `tests/unit/editing/edit-operations.test.ts` (Verify: `pnpm test -- --run tests/unit/editing/edit-operations.test.ts`)
- [x] T036 [P] [US2] Add save/load persistence tests for edited revisions in `tests/integration/save-load-project.test.ts` (Verify: `pnpm test -- --run tests/integration/save-load-project.test.ts`)
- [x] T037 [P] [US2] Add editor route render tests in `tests/unit/editor/project-editor.test.tsx` (Verify: `pnpm test -- --run tests/unit/editor/project-editor.test.tsx`)

### Implementation for User Story 2

- [x] T038 [P] [US2] Implement typed edit operations in `src/editing/edit-operations.ts` (Verify: `pnpm test -- --run tests/unit/editing/edit-operations.test.ts`)
- [x] T039 [US2] Implement edit state and user-edited field tracking in `src/editing/edit-state.ts` (Verify: `pnpm test -- --run tests/unit/editing/edit-operations.test.ts`)
- [x] T040 [P] [US2] Implement section add/delete/reorder helpers in `src/editing/section-operations.ts` (Verify: `pnpm test -- --run tests/unit/editing/edit-operations.test.ts`)
- [x] T041 [US2] Extend project service save/load edited revision behavior in `src/projects/project-service.ts` (Verify: `pnpm test -- --run tests/integration/save-load-project.test.ts`)
- [x] T042 [P] [US2] Build editor panels for content, products, theme, and section order in `app/components/editor/content-panel.tsx`, `app/components/editor/product-panel.tsx`, `app/components/editor/theme-panel.tsx`, and `app/components/editor/section-panel.tsx` (Verify: `pnpm test -- --run tests/unit/editor/project-editor.test.tsx`)
- [x] T043 [US2] Wire project editor route actions for save/load in `app/routes/projects.$projectId.tsx` and `app/server/actions/save-project.ts` (Verify: `pnpm test -- --run tests/integration/save-load-project.test.ts`)
- [x] T044 [US2] Run User Story 2 validation for editing and persistence (Verify: `pnpm test -- --run tests/unit/editing/edit-operations.test.ts tests/integration/save-load-project.test.ts && pnpm build`)

**Checkpoint**: Users can edit storefront data, save changes, reload projects, and see updated preview data.

---

## Phase 5: User Story 3 - Regenerate Specific Storefront Parts Safely (Priority: P1)

**Goal**: Users regenerate a whole storefront, page, section, copywriting, layout, or product descriptions while preserving manual edits unless overwrite is explicit.

**Independent Test**: Manually edit a section, regenerate a different section, verify edited content remains, then regenerate the edited section with overwrite and verify only the target changes.

### Tests for User Story 3

- [x] T045 [P] [US3] Add merge-user-edits unit tests for preserving manual edits and explicit overwrite in `tests/unit/storefront/merge-user-edits.test.ts` (Verify: `pnpm test -- --run tests/unit/storefront/merge-user-edits.test.ts`)
- [x] T046 [P] [US3] Add scoped regeneration service tests for section, copywriting, layout, and product descriptions in `tests/unit/ai/scoped-regeneration.test.ts` (Verify: `pnpm test -- --run tests/unit/ai/scoped-regeneration.test.ts`)
- [x] T047 [P] [US3] Add invalid regeneration output regression test in `tests/integration/regenerate-section-errors.test.ts` (Verify: `pnpm test -- --run tests/integration/regenerate-section-errors.test.ts`)

### Implementation for User Story 3

- [x] T048 [US3] Implement merge policy preserving user edits by default in `src/storefront/merge-user-edits.ts` (Verify: `pnpm test -- --run tests/unit/storefront/merge-user-edits.test.ts`)
- [x] T049 [US3] Extend generation service with scoped regeneration and overwrite behavior in `src/ai/generation-service.ts` (Verify: `pnpm test -- --run tests/unit/ai/scoped-regeneration.test.ts`)
- [x] T050 [P] [US3] Add regenerate action contract in `app/server/actions/regenerate-section.ts` (Verify: `pnpm typecheck`)
- [x] T051 [US3] Wire regenerate controls in `app/components/editor/section-panel.tsx` and `app/routes/projects.$projectId.tsx` (Verify: `pnpm test -- --run tests/integration/regenerate-section-errors.test.ts`)
- [x] T052 [US3] Persist regeneration records for success and validation failure in `src/projects/project-service.ts` and `src/projects/project-repository.ts` (Verify: `pnpm test -- --run tests/unit/ai/scoped-regeneration.test.ts tests/integration/regenerate-section-errors.test.ts`)
- [x] T053 [US3] Run User Story 3 validation for scoped regeneration and edit preservation (Verify: `pnpm test -- --run tests/unit/storefront/merge-user-edits.test.ts tests/unit/ai/scoped-regeneration.test.ts tests/integration/regenerate-section-errors.test.ts && pnpm build`)

**Checkpoint**: Regeneration can target specific scopes and cannot destroy unrelated manual edits.

---

## Phase 6: User Story 4 - Preview URL Output Provider (Priority: P2)

**Goal**: Users produce a stable draft preview URL output for a persisted project revision.

**Independent Test**: Generate a valid storefront, create a preview token, open `/preview/$previewToken`, and verify draft indicator plus storefront content.

### Tests for User Story 4

- [x] T054 [P] [US4] Add preview provider unit tests in `tests/unit/export/preview-url-provider.test.ts` (Verify: `pnpm test -- --run tests/unit/export/preview-url-provider.test.ts`)
- [x] T055 [P] [US4] Add preview route integration test in `tests/integration/preview-url.test.ts` (Verify: `pnpm test -- --run tests/integration/preview-url.test.ts`)
- [x] T056 [P] [US4] Add E2E happy path test for create project -> generate storefront -> preview URL in `tests/e2e/create-generate-preview.spec.tsx` (Verify: `pnpm test -- --run tests/e2e/create-generate-preview.spec.tsx`)

### Implementation for User Story 4

- [x] T057 [P] [US4] Define output provider interface in `src/export/output-provider.ts` (Verify: `pnpm typecheck`)
- [x] T058 [US4] Implement preview URL provider in `src/export/preview-url-provider.ts` (Verify: `pnpm test -- --run tests/unit/export/preview-url-provider.test.ts`)
- [x] T059 [US4] Implement preview service token lifecycle in `src/projects/preview-service.ts` (Verify: `pnpm test -- --run tests/integration/preview-url.test.ts`)
- [x] T060 [US4] Implement preview route loader and draft preview page in `app/routes/preview.$previewToken.tsx` (Verify: `pnpm test -- --run tests/integration/preview-url.test.ts`)
- [x] T061 [US4] Add preview output action to project editor in `app/server/actions/create-preview.ts` and `app/components/editor/preview-actions.tsx` (Verify: `pnpm build`)
- [x] T062 [US4] Run User Story 4 validation including E2E happy path (Verify: `pnpm test -- --run tests/unit/export/preview-url-provider.test.ts tests/integration/preview-url.test.ts tests/e2e/create-generate-preview.spec.tsx && pnpm build`)

**Checkpoint**: Preview URL mode works as V1 export/publishing output without real domain publishing.

---

## Phase 7: User Story 5 - Operator Visibility (Priority: P2)

**Goal**: Operators inspect prompts, structured outputs, validation errors, generation history, project state, and preview/export state without exposing secrets.

**Independent Test**: Trigger successful and failed generation records, open operator view, verify history/state/errors are visible and secrets are redacted.

### Tests for User Story 5

- [x] T063 [P] [US5] Add redaction unit tests for secret-like values in `tests/unit/security/redaction.test.ts` (Verify: `pnpm test -- --run tests/unit/security/redaction.test.ts`)
- [x] T064 [P] [US5] Add operator history integration tests in `tests/integration/operator-project-state.test.ts` (Verify: `pnpm test -- --run tests/integration/operator-project-state.test.ts`)
- [x] T065 [P] [US5] Add provider failure and unsafe content error tests in `tests/integration/generation-errors.test.ts` (Verify: `pnpm test -- --run tests/integration/generation-errors.test.ts`)

### Implementation for User Story 5

- [x] T066 [P] [US5] Implement secret redaction utility in `src/security/redaction.ts` (Verify: `pnpm test -- --run tests/unit/security/redaction.test.ts`)
- [x] T067 [US5] Implement operator-safe project state query in `src/projects/operator-service.ts` (Verify: `pnpm test -- --run tests/integration/operator-project-state.test.ts`)
- [x] T068 [P] [US5] Build operator route for project state and generation history in `app/routes/projects.$projectId.admin.tsx` (Verify: `pnpm test -- --run tests/integration/operator-project-state.test.ts`)
- [x] T069 [US5] Ensure provider failures, validation failures, and safety blocks create operator-visible records in `src/ai/generation-service.ts` (Verify: `pnpm test -- --run tests/integration/generation-errors.test.ts`)
- [x] T070 [US5] Run User Story 5 validation for operator visibility and error handling (Verify: `pnpm test -- --run tests/unit/security/redaction.test.ts tests/integration/operator-project-state.test.ts tests/integration/generation-errors.test.ts && pnpm build`)

**Checkpoint**: Operators can inspect generation/project state safely and error paths are recorded without secret leakage.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, final quality gates, and release readiness across all stories.

- [x] T071 [P] Update README with local setup, `.env`, AI provider configuration, database migration, preview mode, and test commands in `README.md` (Verify: `rg -n "AI_PROVIDER|DATABASE_URL|preview|pnpm test" README.md`)
- [x] T072 [P] Add developer notes for schema/provider/output extension points in `docs/ai-storefront-builder.md` (Verify: `rg -n "AIProvider|OutputProvider|StorefrontSection" docs/ai-storefront-builder.md`)
- [x] T073 [P] Add `.env.example` completeness test or script in `tests/unit/config/env-example.test.ts` (Verify: `pnpm test -- --run tests/unit/config/env-example.test.ts`)
- [x] T074 Run full lint/typecheck/test/build validation and fix only feature-related failures across the repo (Verify: `pnpm lint && pnpm typecheck && pnpm test -- --run && pnpm build`)
- [x] T075 Review dependency additions and remove unused packages in `package.json` and lockfile (Verify: `pnpm lint && pnpm build`)
- [x] T076 Final manual preview smoke test using quickstart flow in `specs/001-ai-storefront-builder/quickstart.md` (Verify: `pnpm build`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; start immediately.
- **Foundation (Phase 2)**: Depends on Setup; blocks all user stories.
- **US1 Generate and Preview (Phase 3)**: Depends on Foundation; recommended MVP.
- **US2 Editing (Phase 4)**: Depends on Foundation and benefits from US1 renderer/project service.
- **US3 Regeneration (Phase 5)**: Depends on US1 generation service and US2 edit metadata.
- **US4 Preview Output (Phase 6)**: Depends on US1 project/revision data and renderer.
- **US5 Operator Visibility (Phase 7)**: Depends on generation records and persistence from US1/US3.
- **Polish (Phase 8)**: Depends on selected stories being complete.

### User Story Dependencies

- **US1 (P1)**: First deliverable; creates project, generation service, renderer, and basic route.
- **US2 (P1)**: Can begin after Foundation, but full save/load validation uses US1 project service.
- **US3 (P1)**: Requires US1 generation pipeline and US2 edit tracking.
- **US4 (P2)**: Requires persisted revisions and renderer from US1.
- **US5 (P2)**: Requires generation history and persistence from US1/US3.

### Within Each User Story

- Write tests before implementation where test tasks exist.
- Define types/interfaces before services.
- Implement services before routes/actions.
- Implement route/UI wiring after service behavior is testable.
- Run each story checkpoint before proceeding to the next story.

## Parallel Opportunities

- T006, T007, T008, T012, T013 can be started in parallel after Setup.
- T017, T018, T019, T020, T021 can be written in parallel for US1.
- T022, T024, T027, T029, T031, T032 are parallelizable once US1 tests exist.
- T035, T036, T037 can be written in parallel for US2.
- T038, T040, T042 can be implemented in parallel after US2 tests exist.
- T045, T046, T047 can be written in parallel for US3.
- T054, T055, T056 can be written in parallel for US4.
- T063, T064, T065 can be written in parallel for US5.
- T071, T072, T073 can run in parallel during polish.

## Parallel Example: User Story 1

```bash
Task: "T017 Add AI provider interface contract tests in tests/unit/ai/ai-provider.test.ts"
Task: "T018 Add AI output parsing tests in tests/unit/ai/output-parser.test.ts"
Task: "T020 Add renderer tests in tests/unit/rendering/storefront-renderer.test.tsx"
Task: "T031 Build storefront components in app/components/storefront/"
```

## Parallel Example: User Story 2

```bash
Task: "T035 Add edit operation tests in tests/unit/editing/edit-operations.test.ts"
Task: "T036 Add save/load persistence tests in tests/integration/save-load-project.test.ts"
Task: "T042 Build editor panels in app/components/editor/"
```

## Parallel Example: User Story 4

```bash
Task: "T054 Add preview provider tests in tests/unit/export/preview-url-provider.test.ts"
Task: "T055 Add preview route integration tests in tests/integration/preview-url.test.ts"
Task: "T057 Define output provider interface in src/export/output-provider.ts"
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 Setup.
2. Complete Phase 2 Foundation with schema, validation, safety, and persistence contracts.
3. Complete Phase 3 US1 for create-from-prompt, real provider adapter, validation, persistence, and renderer.
4. Stop and validate with T034 before moving to editing/regeneration.

### Incremental Delivery

1. Foundation ready: typed schema and validation can be reviewed independently.
2. US1: generated structured storefront data renders from schema.
3. US2: users can edit and save/reload content/theme/product/sections.
4. US3: scoped regeneration preserves manual edits.
5. US4: preview URL output is available as V1 export/publish target.
6. US5: operator visibility and error handling complete support workflows.
7. Polish: docs, full validation, dependency cleanup.

## Task Review Rules

- Each task should be reviewable as a small PR or commit.
- Do not combine schema, AI provider, renderer, editor, and persistence changes into one task.
- Do not call the live AI provider from automated tests unless the test is explicitly opt-in and skipped without keys.
- Do not commit `.env` with real secrets.
- Do not add dependencies outside the task scope without documenting the reason in the task PR/commit.
