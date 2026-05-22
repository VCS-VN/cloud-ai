# Tasks: Project Design Rules

**Input**: Design documents from `/specs/017-project-design-rules/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because constitution requires tests for important business rules.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared constants, contracts, and documentation surfaces used by all stories.

- [ ] T001 Create fixed Phase 1 design token role constants in `src/features/ai-agent/code-tools/services/design-token-schema.server.ts`
- [ ] T002 Create design section heading constants and managed notice constants in `src/features/ai-agent/code-tools/services/design-file-contract.server.ts`
- [ ] T003 [P] Add project design rules overview to `README.md`
- [ ] T004 [P] Update generated project design rules notes in `src/features/ai-agent/code-tools/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core validation, parsing, and token mapping prerequisites required before any user story can be delivered.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T005 Add parseable hybrid `DESIGN.md` metadata/token block support to `src/features/ai-agent/code-tools/services/design-file-service.server.ts`
- [ ] T006 Implement lightweight managed design file validator in `src/features/ai-agent/code-tools/services/design-file-validator.server.ts`
- [ ] T007 [P] Implement color parsing and WCAG contrast helpers in `src/features/ai-agent/code-tools/services/design-color-contrast.server.ts`
- [ ] T008 [P] Implement deterministic design seed helper from project identity and normalized prompt in `src/features/ai-agent/planning/design-intent-heuristic.ts`
- [ ] T009 Implement structured token extractor reading token `.value` entries in `src/features/ai-agent/code-tools/services/design-token-extractor.server.ts`
- [ ] T010 Implement deterministic token mapping generator with owned regions in `src/features/ai-agent/code-tools/services/design-token-mapping-service.server.ts`
- [ ] T011 Add unit tests for design validator success and failure cases in `src/features/ai-agent/code-tools/services/__tests__/design-file-validator.test.ts`
- [ ] T012 Add unit tests for contrast thresholds in `src/features/ai-agent/code-tools/services/__tests__/design-color-contrast.test.ts`
- [ ] T013 Add unit tests for structured token extraction in `src/features/ai-agent/code-tools/services/__tests__/design-token-extractor.test.ts`
- [ ] T014 Add unit tests for deterministic token mapping region replacement in `src/features/ai-agent/code-tools/services/__tests__/design-token-mapping-service.test.ts`

**Checkpoint**: Foundation ready - design files can be parsed, validated, indexed, and mapped before story implementation.

---

## Phase 3: User Story 1 - Initialize A Distinct Retail Design System (Priority: P1) 🎯 MVP

**Goal**: New retail storefront projects receive valid project-local design rules before customer-facing UI generation, with deterministic project-specific variety.

**Independent Test**: Create two retail projects from the same broad prompt but different project identities, then verify each has a valid root `DESIGN.md` with distinct direction and generated UI that follows its own design rules.

### Tests for User Story 1

- [ ] T015 [P] [US1] Add tests for generated hybrid `DESIGN.md` structure in `src/features/ai-agent/code-tools/services/__tests__/design-generation-service.test.ts`
- [ ] T016 [P] [US1] Add tests for deterministic variety by project identity in `src/features/ai-agent/planning/__tests__/design-intent-heuristic.test.ts`
- [ ] T017 [P] [US1] Add tests for init orchestration ordering in `src/features/ai-agent/agent/__tests__/project-design-init-flow.test.ts`

### Implementation for User Story 1

- [ ] T018 [US1] Update design generation prompt to emit managed hybrid design files in `src/features/ai-agent/code-tools/services/design-generation-service.server.ts`
- [ ] T019 [US1] Update static boilerplate composition to include managed notice and structured metadata in `src/features/ai-agent/code-tools/services/design-static-boilerplate.server.ts`
- [ ] T020 [US1] Update structural outline to require fixed sections and Section 1 rationale in `src/features/ai-agent/code-tools/services/design-skill-outline.server.ts`
- [ ] T021 [US1] Update fallback visual design generation to use deterministic project-varied direction in `src/features/ai-agent/code-tools/services/design-generation-service.server.ts`
- [ ] T022 [US1] Pass project identity into design generation and seed logic in `src/features/ai-agent/code-tools/services/design-file-service.server.ts`
- [ ] T023 [US1] Validate generated design files before acceptance in `src/features/ai-agent/code-tools/services/design-file-service.server.ts`
- [ ] T024 [US1] Refresh token mapping immediately after design file generation in `src/features/ai-agent/agent/agent-orchestrator.server.ts`
- [ ] T025 [US1] Ensure init infrastructure provides token mapping owned regions in generated `tailwind.config.ts` and style files via `src/features/ai-agent/source/init-source.server.ts`
- [ ] T026 [US1] Update retail init prompt to state project-local design rules and mapped token utilities in `src/features/ai-agent/agent/init-prompt.server.ts`

**Checkpoint**: User Story 1 is independently functional and testable as MVP.

---

## Phase 4: User Story 2 - Keep Storefront Updates Consistent With Project Design (Priority: P2)

**Goal**: Later customer-facing storefront UI changes must load current project design rules and validate changed UI files against approved tokens.

**Independent Test**: Request a customer-facing UI update and verify mutation fails without loaded design rules, then passes only when changed UI uses approved token utilities.

### Tests for User Story 2

- [ ] T027 [P] [US2] Add tests for path-based UI mutation gate in `src/features/ai-agent/code-tools/__tests__/design-rule-gate.test.ts`
- [ ] T028 [P] [US2] Add tests for disallowed raw visual literals in `src/features/ai-agent/code-tools/services/__tests__/design-patch-content-validator.test.ts`
- [ ] T029 [P] [US2] Add tests for project validation design-compliance failures in `src/features/ai-agent/code-tools/services/__tests__/project-validation-design-compliance.test.ts`

### Implementation for User Story 2

- [ ] T030 [US2] Expand UI path detection for storefront customer-facing paths in `src/features/ai-agent/code-tools/services/project-path-guard.server.ts`
- [ ] T031 [US2] Enforce design rule loaded flag and hash trace for all UI mutation tools in `src/features/ai-agent/code-tools/code-tool-executor.server.ts`
- [ ] T032 [US2] Extend patch content validator for raw colors, arbitrary visual utilities, palette utilities, inline visual styles, raw fonts, and raw shadows in `src/features/ai-agent/code-tools/services/design-patch-content-validator.server.ts`
- [ ] T033 [US2] Add approved semantic token utility allowlist from token mapping in `src/features/ai-agent/code-tools/services/design-patch-content-validator.server.ts`
- [ ] T034 [US2] Add design compliance validation mode to project validation in `src/features/ai-agent/code-tools/services/project-validation-service.server.ts`
- [ ] T035 [US2] Wire `project_run_validation` to include scoped design compliance results in `src/features/ai-agent/code-tools/tools/project-run-validation.tool.server.ts`
- [ ] T036 [US2] Update agent prompts to require fresh design-rule reads before possible UI changes in `src/features/ai-agent/agent/agentic-prompts.server.ts`
- [ ] T037 [US2] Update code-agent prompts to describe allowed token utilities and raw literal bans in `src/features/ai-agent/code-tools/code-agent-prompts.server.ts`

**Checkpoint**: User Story 2 works independently for update prompts on existing projects.

---

## Phase 5: User Story 3 - Change Storefront Design Through Managed Prompts (Priority: P3)

**Goal**: Users change tokens or redesign identity through prompts while `DESIGN.md`, token mapping, and storefront UI stay synchronized.

**Independent Test**: Submit token-specific and identity-level redesign prompts, then verify token-specific changes are surgical and redesign changes synchronize the full customer-facing storefront.

### Tests for User Story 3

- [ ] T038 [P] [US3] Add tests for design-change classification in `src/features/ai-agent/planning/__tests__/classify-design-change.test.ts`
- [ ] T039 [P] [US3] Add tests for surgical token patch preserving unrelated intent in `src/features/ai-agent/code-tools/services/__tests__/design-rule-patch-service.test.ts`
- [ ] T040 [P] [US3] Add tests for redesign preserving user-provenance tokens unless conflicting in `src/features/ai-agent/agent/__tests__/project-design-redesign-flow.test.ts`

### Implementation for User Story 3

- [ ] T041 [US3] Add design change classification helpers for feature update, token-specific change, and identity-level redesign in `src/features/ai-agent/planning/classify-intent.server.ts`
- [ ] T042 [US3] Update design rule patch service to patch token `.value`, provenance, and relevant prose only in `src/features/ai-agent/code-tools/services/design-rule-patch-service.server.ts`
- [ ] T043 [US3] Preserve user-provenance tokens during redesign unless current prompt conflicts in `src/features/ai-agent/code-tools/services/design-generation-service.server.ts`
- [ ] T044 [US3] Refresh token mapping after token patch and redesign flows in `src/features/ai-agent/agent/agent-orchestrator.server.ts`
- [ ] T045 [US3] Ensure token-specific prompts validate affected UI scope in `src/features/ai-agent/agent/agent-orchestrator.server.ts`
- [ ] T046 [US3] Ensure redesign prompts validate full customer-facing storefront scope in `src/features/ai-agent/agent/agent-orchestrator.server.ts`
- [ ] T047 [US3] Update redesign rewrite prompt to preserve user tokens and use mapped token utilities in `src/features/ai-agent/agent/agent-orchestrator.server.ts`

**Checkpoint**: User Story 3 enables managed design evolution through prompts.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, regression coverage, and final verification.

- [ ] T048 [P] Add quickstart verification notes to `specs/017-project-design-rules/quickstart.md`
- [ ] T049 [P] Update feature documentation references in `src/features/ai-agent/code-tools/README.md`
- [ ] T050 Add integration test covering init then UI update compliance in `src/features/ai-agent/agent/__tests__/project-design-rules-integration.test.ts`
- [ ] T051 Run targeted tests for design-rule services with `pnpm test -- src/features/ai-agent/code-tools/services/__tests__`
- [ ] T052 Run agent/planning targeted tests with `pnpm test -- src/features/ai-agent/agent/__tests__ src/features/ai-agent/planning/__tests__`
- [ ] T053 Run repository typecheck with `pnpm lint`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1 constants and docs surfaces.
- **Phase 3 US1**: Depends on Phase 2 validator, extractor, seed, and mapping foundation.
- **Phase 4 US2**: Depends on Phase 2 validator/extractor and can start after the mutation gate foundation exists; best after US1 for end-to-end generated project context.
- **Phase 5 US3**: Depends on US1 design generation and Phase 2 mapping foundation; benefits from US2 compliance validation.
- **Phase 6 Polish**: Depends on completed user story phases.

### User Story Dependencies

- **US1** is MVP and can ship independently.
- **US2** depends on the shared design-rule loading and validation foundation; it can be tested on any existing project with valid `DESIGN.md`.
- **US3** depends on design generation/patching foundations and should follow US1; full validation behavior is strongest after US2.

### Parallel Opportunities

- Setup docs tasks T003 and T004 can run in parallel.
- Foundation helpers T007 and T008 can run in parallel.
- Foundation tests T011 through T014 can run in parallel after T006 through T010 exist.
- US1 tests T015 through T017 can run in parallel.
- US2 tests T027 through T029 can run in parallel.
- US3 tests T038 through T040 can run in parallel.
- Polish docs T048 and T049 can run in parallel.

---

## Parallel Execution Examples

### US1 Parallel Work

```text
Task group A: T015, T018, T019, T020
Task group B: T016, T021, T022
Task group C: T017, T024, T025, T026
```

### US2 Parallel Work

```text
Task group A: T027, T030, T031
Task group B: T028, T032, T033
Task group C: T029, T034, T035, T036, T037
```

### US3 Parallel Work

```text
Task group A: T038, T041
Task group B: T039, T042, T044, T045
Task group C: T040, T043, T046, T047
```

---

## Implementation Strategy

### MVP First

Complete Phases 1 through 3. This delivers project-local managed `DESIGN.md` generation before storefront UI, deterministic variety, validation, and token mapping for new retail projects.

### Incremental Delivery

1. Deliver US1 so new retail projects stop sharing one global visual design rule.
2. Deliver US2 so future UI updates cannot drift from the project design rules.
3. Deliver US3 so users can evolve design safely through prompts.
4. Finish Polish tasks for documentation and full regression verification.

### Validation Strategy

- Run focused Vitest files as each service is implemented.
- Run story-level targeted tests at each checkpoint.
- Finish with `pnpm lint` to satisfy repository typecheck and formatting expectations.
