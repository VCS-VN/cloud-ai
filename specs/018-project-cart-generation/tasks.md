# Tasks: Project Cart Generation

**Input**: Design documents from `/specs/018-project-cart-generation/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/
**Tests**: Included because the plan/constitution require tests for important cart business rules and generated source contracts.
**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare contract-test locations and locate generator surfaces before story work.

- [X] T001 Create generated source contract test scaffold in `src/features/ai-agent/source/__tests__/project-cart-generation.test.ts`
- [X] T002 [P] Create generated prompt contract test scaffold in `src/features/ai-agent/agent/__tests__/project-cart-generation-prompt.test.ts`
- [X] T003 [P] Create runtime prompt contract test scaffold in `src/features/ai-agent/store-runtime/__tests__/project-cart-generation-runtime-prompt.test.ts`
- [X] T004 Document current generated cart placeholder locations as test fixtures in `src/features/ai-agent/source/__tests__/project-cart-generation.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared generated layout, provider ordering, and prompt contracts needed by all user stories.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Add `src/app/auth-provider.tsx` and `src/app/cart-selection.ts` to required generated file layout in `src/features/ai-agent/source/generated-project-layout.ts`
- [X] T006 Add source contract assertions for required auth/cart files and root provider order in `src/features/ai-agent/source/__tests__/project-cart-generation.test.ts`
- [X] T007 Add prompt contract assertions for AuthProvider, active CartProvider, `store_cart`, selected model id, and shared `apiClient` in `src/features/ai-agent/agent/__tests__/project-cart-generation-prompt.test.ts`
- [X] T008 Add runtime prompt contract assertions for provider order, cart APIs, selected model behavior, and no native fetch in `src/features/ai-agent/store-runtime/__tests__/project-cart-generation-runtime-prompt.test.ts`
- [X] T009 Generate `src/app/auth-provider.tsx` source and `src/app/cart-selection.ts` source from `src/features/ai-agent/source/init-source.server.ts`
- [X] T010 Update generated root route provider order to `Providers -> StoreProvider -> AuthProvider -> CartProvider` in `src/features/ai-agent/source/init-source.server.ts`
- [X] T011 Update initial project prompt imports and file requirements for AuthProvider, active CartProvider, and cart selection state in `src/features/ai-agent/agent/init-prompt.server.ts`
- [X] T012 Update runtime storefront prompt provider-order and cart-runtime rules in `src/features/ai-agent/store-runtime/store-runtime-prompt.ts`

**Checkpoint**: Generated files, provider order, and prompt contracts are ready for story work.

---

## Phase 3: User Story 1 - Manage Cart From Product Detail (Priority: P1) MVP

**Goal**: Shopper selects a product model on product detail, sees current cart quantity, and add/update/remove behavior uses selected model id.

**Independent Test**: Generate source output, inspect product detail and cart provider contracts, then verify no model is preselected, add/update is disabled until model selection, existing model quantity is loaded, repeated add combines quantity, update sets quantity, and quantity 0 removes the item.

### Tests for User Story 1

- [X] T013 [P] [US1] Add CartProvider action contract tests for add, update, remove, clear, `getItemQuantity`, and selected model id identity in `src/features/ai-agent/source/__tests__/project-cart-generation.test.ts`
- [X] T014 [P] [US1] Add product detail source contract tests for no preselected model, disabled add/update before model selection, default price display, and mobile confirm disabled state in `src/features/ai-agent/source/__tests__/project-cart-generation.test.ts`
- [X] T015 [P] [US1] Add initial prompt assertions for product-detail-only cart mutation and no product-card add-to-cart mutation in `src/features/ai-agent/agent/__tests__/project-cart-generation-prompt.test.ts`

### Implementation for User Story 1

- [X] T016 [US1] Replace generated empty CartProvider scaffold with active cart state, types, flattened items, totals, `addItem`, `updateItemQuantity`, `removeItem`, `clearCart`, and `getItemQuantity` in `src/features/ai-agent/source/init-source.server.ts`
- [X] T017 [US1] Implement guest cart helpers for fixed `store_cart` key, same cart response shape, quantity combine, quantity set, quantity 0 remove, and current store clear in `src/features/ai-agent/source/init-source.server.ts`
- [X] T018 [US1] Update generated product detail route to require explicit selected model, use default model only for display price, show current selected model quantity, and call cart add/update/remove actions in `src/features/ai-agent/source/init-source.server.ts`
- [X] T019 [US1] Remove generated product-card cart mutation instructions and require detail-page model selection instead in `src/features/ai-agent/agent/init-prompt.server.ts`
- [X] T020 [US1] Mirror product detail cart rules in runtime storefront prompt in `src/features/ai-agent/store-runtime/store-runtime-prompt.ts`
- [X] T021 [US1] Update generated cart item source to expose active quantity controls and remove action hooks instead of disabled controls in `src/features/ai-agent/source/init-source.server.ts`

**Checkpoint**: User Story 1 is independently functional for generated guest cart behavior from product detail.

---

## Phase 4: User Story 2 - Preserve Guest and Account Cart Modes (Priority: P1)

**Goal**: Generated storefront uses profile-aware guest/account cart mode, merges guest cart when needed, and persists account changes without response sync, rollback, or error notification.

**Independent Test**: Generate source output and verify AuthProvider profile loading/logout/401 behavior, CartProvider waits for store/auth readiness, loads account cart page 1 limit 100, bulk-merges guest cart only when items exist, and account mutations update UI before persistence while ignoring responses and failures.

### Tests for User Story 2

- [X] T022 [P] [US2] Add AuthProvider source contract tests for profile fields, loading state, logout, unauthorized cleanup, and no exposed error in `src/features/ai-agent/source/__tests__/project-cart-generation.test.ts`
- [X] T023 [P] [US2] Add account cart API source contract tests for load, add, update, remove, clear, bulk merge, page 1, limit 100, and selected model id usage in `src/features/ai-agent/source/__tests__/project-cart-generation.test.ts`
- [X] T024 [P] [US2] Add generated API client policy tests for profile/cart using shared `apiClient` and no native fetch in `src/features/ai-agent/code-tools/services/__tests__/generated-api-client-policy-cart.test.ts`

### Implementation for User Story 2

- [X] T025 [US2] Implement generated AuthProvider profile query, authenticated mode detection, logout action, and unauthorized credential cleanup in `src/features/ai-agent/source/init-source.server.ts`
- [X] T026 [US2] Implement generated account cart service helpers for `GET /api/v1/carts`, `POST /api/v1/carts`, `PATCH /api/v1/carts/{id}`, `DELETE /api/v1/carts/{id}`, `DELETE /api/v1/carts/all`, and `POST /api/v1/carts/items/bulk` in `src/features/ai-agent/source/init-source.server.ts`
- [X] T027 [US2] Implement generated CartProvider readiness flow that waits for store and auth, bulk-merges guest items when present, skips merge when empty, loads account cart, and clears guest storage after successful merge in `src/features/ai-agent/source/init-source.server.ts`
- [X] T028 [US2] Implement generated account mutation behavior that updates UI first, calls persistence second, ignores responses, ignores failures, and does not show error toast in `src/features/ai-agent/source/init-source.server.ts`
- [X] T029 [US2] Update initial prompt with exact profile and account cart endpoint contracts from `specs/018-project-cart-generation/contracts/cart-api-contract.md` in `src/features/ai-agent/agent/init-prompt.server.ts`
- [X] T030 [US2] Update runtime prompt with exact profile and account cart endpoint contracts from `specs/018-project-cart-generation/contracts/cart-api-contract.md` in `src/features/ai-agent/store-runtime/store-runtime-prompt.ts`
- [X] T031 [US2] Extend generated API client policy scanner to flag native fetch or non-`apiClient` profile/cart requests in `src/features/ai-agent/code-tools/services/generated-api-client-policy.server.ts`

**Checkpoint**: User Story 2 is independently functional for generated guest/account mode and persistence behavior.

---

## Phase 5: User Story 3 - Select Items In Cart For Checkout (Priority: P2)

**Goal**: Cart page lets shoppers select specific items, see selected totals, and navigate to checkout with cart-origin mode using globally stored selected item ids.

**Independent Test**: Generate source output, inspect cart route and checkout route, then verify default empty selection, per-item checkbox, select-all toggle, selected subtotal/count, disabled checkout with no selection, enabled checkout with selection, and checkout navigation with `method=cart`.

### Tests for User Story 3

- [X] T032 [P] [US3] Add cart selection atom source contract tests for selected item ids only and no full item snapshots in `src/features/ai-agent/source/__tests__/project-cart-generation.test.ts`
- [X] T033 [P] [US3] Add cart route source contract tests for default empty selection, per-item checkbox, select all toggle, selected summary, and disabled checkout when none selected in `src/features/ai-agent/source/__tests__/project-cart-generation.test.ts`
- [X] T034 [P] [US3] Add checkout route source contract tests for `method=cart` handling and deriving selected item details from ids plus current cart state in `src/features/ai-agent/source/__tests__/project-cart-generation.test.ts`

### Implementation for User Story 3

- [X] T035 [US3] Generate `src/app/cart-selection.ts` with selected cart item ids atom only in `src/features/ai-agent/source/init-source.server.ts`
- [X] T036 [US3] Replace generated cart route placeholder with grouped cart item list, per-item checkbox, select-all toggle, selected subtotal/count summary, clear all, and checkout navigation with `method=cart` in `src/features/ai-agent/source/init-source.server.ts`
- [X] T037 [US3] Update generated checkout route to accept cart-origin mode and derive selected item details from selected ids plus current cart state in `src/features/ai-agent/source/init-source.server.ts`
- [X] T038 [US3] Add cart page selection and checkout navigation rules to initial prompt in `src/features/ai-agent/agent/init-prompt.server.ts`
- [X] T039 [US3] Add cart page selection and checkout navigation rules to runtime prompt in `src/features/ai-agent/store-runtime/store-runtime-prompt.ts`

**Checkpoint**: User Story 3 is independently functional for cart page selection and checkout preparation.

---

## Phase 6: User Story 4 - Review Cart State Across Storefront Surfaces (Priority: P3)

**Goal**: Header badge, cart empty state, cart item list, and selected summary consistently reflect shared cart state.

**Independent Test**: Generate source output and verify the header badge appears only when total item quantity is greater than 0, cart route empty state replaces placeholder messaging, and clear/remove actions keep selected ids and totals consistent.

### Tests for User Story 4

- [X] T040 [P] [US4] Add site header source contract tests for cart badge shown only when `totalItems > 0` in `src/features/ai-agent/source/__tests__/project-cart-generation.test.ts`
- [X] T041 [P] [US4] Add cart route source contract tests for empty state, no "Cart coming soon" message, clear all, and selected id cleanup in `src/features/ai-agent/source/__tests__/project-cart-generation.test.ts`

### Implementation for User Story 4

- [X] T042 [US4] Update generated site header source to read `totalItems` from `useCart()` and render a cart badge only when greater than 0 in `src/features/ai-agent/source/init-source.server.ts`
- [X] T043 [US4] Ensure generated cart route empty state, remove item, clear cart, and selection cleanup all use shared cart state in `src/features/ai-agent/source/init-source.server.ts`
- [X] T044 [US4] Update initial prompt header/cart page rules for cart badge and no cart placeholder messaging in `src/features/ai-agent/agent/init-prompt.server.ts`
- [X] T045 [US4] Update runtime prompt header/cart page rules for cart badge and no cart placeholder messaging in `src/features/ai-agent/store-runtime/store-runtime-prompt.ts`

**Checkpoint**: User Story 4 is independently functional for storefront-wide cart state visibility.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate whole feature, remove stale placeholder language, and prepare implementation handoff.

- [X] T046 [P] Remove or rewrite stale "CartProvider scaffold", "cart not wired", and "Cart coming soon" instructions in `src/features/ai-agent/agent/init-prompt.server.ts`
- [X] T047 [P] Remove or rewrite stale "Cart coming soon" runtime instructions in `src/features/ai-agent/store-runtime/store-runtime-prompt.ts`
- [X] T048 [P] Add source generator smoke assertion that `initSource` emits all cart/auth files in `src/features/ai-agent/source/__tests__/project-cart-generation.test.ts`
- [X] T049 Run targeted generated cart/auth tests with `pnpm test src/features/ai-agent/source/__tests__/project-cart-generation.test.ts`
- [X] T050 Run generated prompt contract tests with `pnpm test src/features/ai-agent/agent/__tests__/project-cart-generation-prompt.test.ts src/features/ai-agent/store-runtime/__tests__/project-cart-generation-runtime-prompt.test.ts`
- [X] T051 Run API client policy tests with `pnpm test src/features/ai-agent/code-tools/services/__tests__/generated-api-client-policy-cart.test.ts`
- [X] T052 Run repository typecheck with `pnpm lint` from `package.json`
- [X] T053 Update quickstart validation notes after implementation in `specs/018-project-cart-generation/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational; MVP slice.
- **US2 (Phase 4)**: Depends on Foundational and active CartProvider shape from US1.
- **US3 (Phase 5)**: Depends on Foundational and cart item state shape from US1.
- **US4 (Phase 6)**: Depends on shared cart state from US1 and cart route/header surfaces.
- **Polish (Phase 7)**: Depends on desired user stories being complete.

### User Story Dependencies

- **US1 Manage Cart From Product Detail (P1)**: First MVP; establishes active CartProvider and product detail mutation.
- **US2 Preserve Guest and Account Cart Modes (P1)**: Can start after CartProvider shape is available; adds AuthProvider and account persistence.
- **US3 Select Items In Cart For Checkout (P2)**: Can start after cart item shape is available; adds selected ids and cart route selection.
- **US4 Review Cart State Across Storefront Surfaces (P3)**: Can start after shared cart state exists; adds header badge and consistency polish.

### Parallel Opportunities

- T002 and T003 can run parallel after T001.
- T006, T007, and T008 can run parallel after test scaffolds exist.
- US1 tests T013, T014, and T015 can run parallel.
- US2 tests T022, T023, and T024 can run parallel.
- US3 tests T032, T033, and T034 can run parallel.
- US4 tests T040 and T041 can run parallel.
- Polish cleanup T046, T047, and T048 can run parallel once story implementation is complete.

---

## Parallel Example: User Story 1

```bash
Task: "Add CartProvider action contract tests for add, update, remove, clear, getItemQuantity, and selected model id identity in src/features/ai-agent/source/__tests__/project-cart-generation.test.ts"
Task: "Add product detail source contract tests for no preselected model, disabled add/update before model selection, default price display, and mobile confirm disabled state in src/features/ai-agent/source/__tests__/project-cart-generation.test.ts"
Task: "Add initial prompt assertions for product-detail-only cart mutation and no product-card add-to-cart mutation in src/features/ai-agent/agent/__tests__/project-cart-generation-prompt.test.ts"
```

---

## Parallel Example: User Story 2

```bash
Task: "Add AuthProvider source contract tests for profile fields, loading state, logout, unauthorized cleanup, and no exposed error in src/features/ai-agent/source/__tests__/project-cart-generation.test.ts"
Task: "Add account cart API source contract tests for load, add, update, remove, clear, bulk merge, page 1, limit 100, and selected model id usage in src/features/ai-agent/source/__tests__/project-cart-generation.test.ts"
Task: "Add generated API client policy tests for profile/cart using shared apiClient and no native fetch in src/features/ai-agent/code-tools/services/__tests__/generated-api-client-policy-cart.test.ts"
```

---

## Parallel Example: User Story 3

```bash
Task: "Add cart selection atom source contract tests for selected item ids only and no full item snapshots in src/features/ai-agent/source/__tests__/project-cart-generation.test.ts"
Task: "Add cart route source contract tests for default empty selection, per-item checkbox, select all toggle, selected summary, and disabled checkout when none selected in src/features/ai-agent/source/__tests__/project-cart-generation.test.ts"
Task: "Add checkout route source contract tests for method=cart handling and deriving selected item details from ids plus current cart state in src/features/ai-agent/source/__tests__/project-cart-generation.test.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate product detail guest cart behavior independently.
4. Stop and demo generated product detail cart add/update/remove before adding account mode.

### Incremental Delivery

1. Add US1 for active product detail cart mutation.
2. Add US2 for profile-aware guest/account mode and persistence.
3. Add US3 for cart page item selection and checkout navigation.
4. Add US4 for header badge and cross-surface consistency.
5. Run Phase 7 validation.

### Notes

- Tasks touching the same source generator file are intentionally sequential inside each story to avoid conflicting edits.
- Prompt tests should fail before prompt/source changes are completed.
- Generated UI must follow project `DESIGN.md`; use reference screenshot layout only as structure guidance.
- Do not implement backend APIs, order creation, payment, or cart drawer behavior in this feature.
