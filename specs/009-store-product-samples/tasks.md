# Tasks: Store and Product Sample Data

**Input**: Design documents from `specs/009-store-product-samples/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/sample-data-update-contract.md`, `quickstart.md`

**Tests**: Required for business rules from constitution Principle II and feature validation rules.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or does not depend on incomplete tasks.
- **[Story]**: Maps task to user story from `spec.md`.
- Every task includes exact file path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Locate existing generation flow and create shared sample-data module boundaries.

- [X] T001 Inspect current project generation and StoreProvider creation flow in `src/agent/agent-runtime.ts`, `src/server/services/project-run-service.ts`, and `src/ai/prompt-builder.ts`
- [X] T002 Inspect current project file writing/update path in `src/agent/project-workspace-service.ts` and `src/server/functions/project-message-stream.ts`
- [X] T003 [P] Create sample-data directory placeholder in `src/shared/sample-data/.gitkeep`
- [X] T004 [P] Create test directory placeholder in `src/shared/sample-data/__tests__/.gitkeep`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define fixed structures, validation, and update primitives that all stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Define Store, StoreSetting, Product, ProductModel, ProductStoreSnapshot, ReviewSummary, Category, and ProductsList TypeScript types in `src/shared/sample-data/store-product-types.ts`
- [X] T006 Encode fixed Store/Product/ProductsList key lists and nested key lists in `src/shared/sample-data/store-product-shape.ts`
- [X] T007 Implement exact shape validation, relationship invariant validation, and duplicate product ID validation in `src/shared/sample-data/store-product-validation.ts`
- [X] T008 Implement fixed-shape cloning and value-only merge helpers in `src/shared/sample-data/store-product-update.ts`
- [X] T009 [P] Add unit tests for exact structure validation in `src/shared/sample-data/__tests__/store-product-validation.test.ts`
- [X] T010 [P] Add unit tests for `entityId === id`, model product ID, default model ID, total count, and duplicate ID invariants in `src/shared/sample-data/__tests__/store-product-invariants.test.ts`
- [X] T011 [P] Add unit tests proving value-only updates cannot add, remove, rename, or reshape fields in `src/shared/sample-data/__tests__/store-product-update.test.ts`
- [X] T012 [P] Add client-side prompt input validation task for empty/oversized sample-data update prompts in `src/components/projects/MessageComposer.tsx`

**Checkpoint**: Fixed data structures and validation rules exist and fail unsafe updates before any generation flow changes.

---

## Phase 3: User Story 1 - Initialize Project With Store Data (Priority: P1) 🎯 MVP

**Goal**: Generated projects include complete sample Store data after pages and components are created.

**Independent Test**: Run the initialization path and verify a complete Store object exists, matches the exact Store shape, and is available for project use.

### Tests for User Story 1

- [X] T013 [P] [US1] Add initialization test for generated Store shape in `src/shared/sample-data/__tests__/store-sample-factory.test.ts`
- [X] T014 [P] [US1] Add generation-flow test that sample Store is created after page/component creation in `src/server/functions/project-message-stream.test.ts`

### Implementation for User Story 1

- [X] T015 [US1] Implement Store sample factory using exact Store shape from `data-model.md` in `src/shared/sample-data/store-sample-factory.ts`
- [X] T016 [US1] Add initialization helper that returns validated Store sample data in `src/shared/sample-data/store-sample-init.ts`
- [X] T017 [US1] Integrate Store sample initialization after pages/components are generated in `src/ai/prompt-builder.ts`
- [X] T018 [US1] Ensure generated project instructions mention StoreProvider receives initialized Store data in `src/agent/agent-runtime.ts`

**Checkpoint**: User Story 1 works independently with complete Store sample data.

---

## Phase 4: User Story 2 - Provide Product List Structure (Priority: P1)

**Goal**: Generated projects include a ProductsList with at least 6 realistic Product records using the exact Product shape.

**Independent Test**: Inspect generated ProductsList and verify `total >= 6`, every product follows the exact Product shape, IDs are unique, and `entityId === id`.

### Tests for User Story 2

- [X] T019 [P] [US2] Add ProductsList factory test for at least 6 products and `total === data.length` in `src/shared/sample-data/__tests__/products-list-sample-factory.test.ts`
- [X] T020 [P] [US2] Add product relationship invariant tests for generated products in `src/shared/sample-data/__tests__/products-list-sample-factory.test.ts`

### Implementation for User Story 2

- [X] T021 [US2] Implement Product sample factory using exact Product shape and `entityId === id` in `src/shared/sample-data/product-sample-factory.ts`
- [X] T022 [US2] Implement ProductsList sample factory with at least 6 realistic nail-studio products in `src/shared/sample-data/products-list-sample-factory.ts`
- [X] T023 [US2] Add SKU, model ID, and product ID generation helpers in `src/shared/sample-data/sample-id-utils.ts`
- [X] T024 [US2] Integrate ProductsList sample initialization with Store sample initialization in `src/shared/sample-data/store-sample-init.ts`
- [X] T025 [US2] Add prompt-builder guidance that generated pages must consume ProductsList structure from shared store data in `src/ai/prompt-builder.ts`

**Checkpoint**: User Story 2 works independently with valid ProductsList and realistic products.

---

## Phase 5: User Story 3 - Use Store Data Project-Wide (Priority: P2)

**Goal**: Pages and components use sample Store and ProductsList from the shared StoreProvider instead of isolated placeholders.

**Independent Test**: Generated project files that display store/product information reference shared StoreProvider data and no longer rely on unrelated static placeholders.

### Tests for User Story 3

- [X] T026 [P] [US3] Add generated-file instruction test for StoreProvider usage in `src/server/functions/project-message-stream.test.ts`
- [X] T027 [P] [US3] Add prompt output parsing test that rejects isolated placeholder sample data when StoreProvider data is available in `src/ai/output-parser.test.ts`

### Implementation for User Story 3

- [X] T028 [US3] Update agent prompt context so all generated pages/components read Store and ProductsList from StoreProvider in `src/ai/prompt-builder.ts`
- [X] T029 [US3] Update agent runtime guardrails to preserve shared store data files during generation and edits in `src/agent/agent-runtime.ts`
- [X] T030 [US3] Update project workspace file application rules to avoid replacing shared sample data with page-local placeholders in `src/agent/project-workspace-service.ts`
- [X] T031 [US3] Add shared sample-data exports for generated project use in `src/shared/sample-data/index.ts`

**Checkpoint**: User Story 3 works independently; generated views use shared StoreProvider data.

---

## Phase 6: User Story 4 - Update Data From User Prompts (Priority: P3)

**Goal**: User prompts can update Store values, Product values, and ProductsList membership/order without changing structure.

**Independent Test**: Apply prompts to change store values, change product values by ID, add/remove/reorder products, and verify structure remains unchanged; ambiguous prompts ask clarification before changes.

### Tests for User Story 4

- [X] T032 [P] [US4] Add tests for product update matching by stable `id` first in `src/shared/sample-data/__tests__/sample-data-prompt-update.test.ts`
- [X] T033 [P] [US4] Add tests for add/remove/reorder product updates preserving Product and ProductsList shapes in `src/shared/sample-data/__tests__/sample-data-prompt-update.test.ts`
- [X] T034 [P] [US4] Add tests for ambiguous target/value returning clarification instead of data changes in `src/shared/sample-data/__tests__/sample-data-prompt-update.test.ts`

### Implementation for User Story 4

- [X] T035 [US4] Implement prompt update plan types for store value changes, product value changes, add/remove/reorder products, and clarification results in `src/shared/sample-data/sample-data-prompt-update.ts`
- [X] T036 [US4] Implement product lookup by stable `id` first and unambiguous fallback matching in `src/shared/sample-data/sample-data-prompt-update.ts`
- [X] T037 [US4] Implement Store value update application with fixed-shape validation in `src/shared/sample-data/sample-data-prompt-update.ts`
- [X] T038 [US4] Implement Product value update and ProductsList add/remove/reorder application with fixed-shape validation in `src/shared/sample-data/sample-data-prompt-update.ts`
- [X] T039 [US4] Integrate prompt update rules into AI prompt instructions so user requests change values but never structure in `src/ai/prompt-builder.ts`
- [X] T040 [US4] Integrate clarification response handling for ambiguous sample-data updates in `src/server/functions/project-message-stream.ts`

**Checkpoint**: User Story 4 works independently; prompt updates are safe and structure-preserving.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, validation, and final checks across all stories.

- [X] T041 [P] Update developer notes for sample data rules in `README.md`
- [X] T042 [P] Ensure public exports and shared imports use `@/` alias for cross-folder imports in `src/shared/sample-data/index.ts`
- [X] T043 Run `pnpm test` and fix only failures caused by this feature
- [X] T044 Run `pnpm typecheck` and fix only failures caused by this feature
- [X] T045 Run `pnpm lint` and fix only failures caused by this feature
- [X] T046 Verify quickstart scenarios from `specs/009-store-product-samples/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1; blocks all user stories.
- **Phase 3 US1**: Depends on Phase 2; MVP scope.
- **Phase 4 US2**: Depends on Phase 2; can run after or alongside US1 if `store-sample-init.ts` ownership is coordinated.
- **Phase 5 US3**: Depends on US1 and US2 because shared StoreProvider data must exist first.
- **Phase 6 US4**: Depends on Phase 2 and benefits from US2 product factories; can start after T021-T024.
- **Phase 7 Polish**: Depends on completed user stories.

### User Story Dependencies

- **US1 → US2**: US2 integrates ProductsList into Store sample initialization.
- **US1 + US2 → US3**: US3 needs shared Store and ProductsList data available.
- **US2 → US4**: US4 update behavior uses Product and ProductsList factories/validation.

### Dependency Graph

```text
Setup -> Foundation -> US1 -> US3 -> Polish
                    -> US2 -> US3
                    -> US2 -> US4 -> Polish
```

## Parallel Execution Examples

### Foundation Parallel Work

```text
Task group A: T005 -> T006 -> T007 -> T008
Task group B: T009
Task group C: T010
Task group D: T011
```

### User Story 1 Parallel Work

```text
T013 and T014 can run in parallel.
T015 -> T016 -> T017 -> T018 run after US1 tests exist.
```

### User Story 2 Parallel Work

```text
T019 and T020 can run in parallel.
T021 and T023 can run in parallel.
T022 depends on T021 and T023.
T024 depends on T022.
T025 can run after T022.
```

### User Story 4 Parallel Work

```text
T032, T033, and T034 can run in parallel.
T035 -> T036 -> T037/T038 -> T039/T040.
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 to initialize Store sample data.
3. Validate Store shape and initialization flow.

### Incremental Delivery

1. Add US2 ProductsList generation and validation.
2. Add US3 project-wide StoreProvider usage.
3. Add US4 prompt-based value/list updates.
4. Run full test/typecheck validation.

### Safety Rules

- Never change Store/Product/ProductsList structures during implementation.
- Preserve `entityId === id` for every product.
- Preserve `productsList.total === productsList.data.length`.
- Ask clarification before ambiguous prompt updates.
- Do not introduce migrations, new app roots, or broad refactors.
