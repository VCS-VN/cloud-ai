# Tasks: Axios HTTP Client Setup

**Input**: Design documents from `specs/006-axios-http-client/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/generated-http-client.md`, `quickstart.md`

**Tests**: Required by the plan for generated source behavior, package metadata, and preview non-regression checks.

**Organization**: Tasks are grouped by user story to keep each story independently implementable and testable.

## Phase 1: Setup

**Purpose**: Confirm current feature context and reviewed source boundaries before implementation.

- [X] T001 Review `specs/006-axios-http-client/plan.md` and confirm implementation scope stays within generated source, code-agent prompt guidance, and tests
- [X] T002 Review `specs/006-axios-http-client/contracts/generated-http-client.md` and confirm required generated artifacts and non-preview constraints
- [X] T003 Document code-review-graph availability result and fallback static review notes in `specs/006-axios-http-client/tasks.md`
- [X] T004 [P] Inspect current generated-source pipeline in `src/features/ai-agent/source/init-source.server.ts`
- [X] T005 [P] Inspect current dependency registry in `src/features/ai-agent/source/package-registry.ts`
- [X] T006 [P] Inspect current code-agent prompt flow in `src/features/ai-agent/code-tools/code-agent-prompts.server.ts`
- [X] T007 [P] Inspect preview boundary files `src/features/ai-agent/runtime/process-manager.server.ts`, `src/features/ai-agent/runtime/presence-service.server.ts`, and `src/routes/projects/$projectId.tsx` without editing them

---

## Phase 2: Foundational

**Purpose**: Add test scaffolding and shared generator helpers that block all user stories.

- [X] T008 Create generated source test fixture helpers in `src/features/ai-agent/source/init-source.server.test.ts`
- [X] T009 Add a reusable `findGeneratedFile` test helper in `src/features/ai-agent/source/init-source.server.test.ts`
- [X] T010 Add a reusable package manifest parser helper in `src/features/ai-agent/source/init-source.server.test.ts`
- [X] T011 Add HTTP client source rendering helper placeholder in `src/features/ai-agent/source/init-source.server.ts`
- [X] T012 Add environment template rendering helper placeholder in `src/features/ai-agent/source/init-source.server.ts`

**Checkpoint**: Test file and generator helper locations are ready before story implementation begins.

---

## Phase 3: User Story 1 - Project Detail Requests Use Shared HTTP Client (Priority: P1)

**Goal**: Newly generated project-detail workspaces include and can use a shared HTTP client file.

**Independent Test**: Generate source through `initSource` and verify `src/services/http/client.ts` exists, exports a shared client/error helpers, and uses alias-compliant imports.

### Tests for User Story 1

- [X] T013 [P] [US1] Add failing test for generated `src/services/http/client.ts` existence in `src/features/ai-agent/source/init-source.server.test.ts`
- [X] T014 [P] [US1] Add failing test for generated HTTP client exports and import alias compliance in `src/features/ai-agent/source/init-source.server.test.ts`
- [X] T015 [P] [US1] Add failing test that generated package manifest contains `axios` at `^1.16.0` in `src/features/ai-agent/source/init-source.server.test.ts`

### Implementation for User Story 1

- [X] T016 [US1] Implement `renderHttpClientSource` in `src/features/ai-agent/source/init-source.server.ts` using the guide-code behavior for shared client, request defaults, normalized errors, and auth retry
- [X] T017 [US1] Add generated `src/services/http/client.ts` entry to `renderInfrastructureFiles` in `src/features/ai-agent/source/init-source.server.ts`
- [X] T018 [US1] Confirm or update axios registry entry to `^1.16.0` in `src/features/ai-agent/source/package-registry.ts`
- [X] T019 [US1] Ensure generated HTTP client imports use `@/` aliases or same-file/local imports only in `src/features/ai-agent/source/init-source.server.ts`
- [X] T020 [US1] Run focused generated-source tests for `src/features/ai-agent/source/init-source.server.test.ts`

**Checkpoint**: User Story 1 is complete when generated source includes the shared HTTP client and axios package metadata without needing US2 or US3.

---

## Phase 4: User Story 2 - HTTP Status Handling Is Consistent (Priority: P2)

**Goal**: The generated HTTP client consistently normalizes failures and handles unauthorized responses with one recovery attempt.

**Independent Test**: Inspect generated `src/services/http/client.ts` content through source-generation tests and verify the client includes retry guards, refresh-request skip behavior, token clearing, and normalized error shape.

### Tests for User Story 2

- [X] T021 [P] [US2] Add failing test for generated `ApiError` shape and `toApiError` helper in `src/features/ai-agent/source/init-source.server.test.ts`
- [X] T022 [P] [US2] Add failing test for generated unauthorized retry guard fields and refresh skip behavior in `src/features/ai-agent/source/init-source.server.test.ts`
- [X] T023 [P] [US2] Add failing test for generated token clearing behavior when refresh is unavailable or unauthorized in `src/features/ai-agent/source/init-source.server.test.ts`

### Implementation for User Story 2

- [X] T024 [US2] Extend `renderHttpClientSource` in `src/features/ai-agent/source/init-source.server.ts` with `ApiError`, `getErrorMessage`, and `toApiError` behavior
- [X] T025 [US2] Extend `renderHttpClientSource` in `src/features/ai-agent/source/init-source.server.ts` with request defaults for timeout, JSON headers, and authorization token injection
- [X] T026 [US2] Extend `renderHttpClientSource` in `src/features/ai-agent/source/init-source.server.ts` with refresh-token single-flight retry logic and refresh-request skip guards
- [X] T027 [US2] Extend `renderHttpClientSource` in `src/features/ai-agent/source/init-source.server.ts` with local auth clear/set/get helper expectations that do not import host app auth code
- [X] T028 [US2] Run focused generated-source tests for `src/features/ai-agent/source/init-source.server.test.ts`

**Checkpoint**: User Story 2 is complete when generated client status/error handling is present and independently verifiable from generated source output.

---

## Phase 5: User Story 3 - Environment Fields Are Centralized (Priority: P3)

**Goal**: Newly generated projects include safe, discoverable environment field documentation and prompt guidance for the HTTP client setup.

**Independent Test**: Generate source and verify `.env.example` contains the API endpoint key consumed by `src/services/http/client.ts`; inspect prompt guidance to confirm HTTP setup runs after shadcn component guidance and requires axios `^1.16.0`.

### Tests for User Story 3

- [X] T029 [P] [US3] Add failing test for generated `.env.example` API endpoint key in `src/features/ai-agent/source/init-source.server.test.ts`
- [X] T030 [P] [US3] Add failing test that generated HTTP client consumes the same env key from `.env.example` in `src/features/ai-agent/source/init-source.server.test.ts`
- [X] T031 [P] [US3] Add failing test or assertion for HTTP setup prompt text in `src/features/ai-agent/code-tools/code-agent-prompts.server.ts`

### Implementation for User Story 3

- [X] T032 [US3] Implement `renderEnvExampleSource` in `src/features/ai-agent/source/init-source.server.ts` with safe non-secret API endpoint placeholder
- [X] T033 [US3] Add generated `.env.example` entry to `renderInfrastructureFiles` in `src/features/ai-agent/source/init-source.server.ts`
- [X] T034 [US3] Add a separated HTTP client setup prompt segment after shadcn guidance in `src/features/ai-agent/code-tools/code-agent-prompts.server.ts`
- [X] T035 [US3] Ensure prompt instructs tool-based creation of `src/services/http/client.ts`, `.env.example`, and axios `^1.16.0` in `src/features/ai-agent/code-tools/code-agent-prompts.server.ts`
- [X] T036 [US3] Run focused source and prompt tests for `src/features/ai-agent/source/init-source.server.test.ts`

**Checkpoint**: User Story 3 is complete when env fields and prompt guidance are discoverable without affecting existing project detail preview behavior.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate implementation quality and preview non-regression.

- [ ] T037 [P] Verify `src/features/ai-agent/runtime/process-manager.server.ts` has no feature-related changes
- [ ] T038 [P] Verify `src/features/ai-agent/runtime/presence-service.server.ts` has no feature-related changes
- [ ] T039 [P] Verify `src/routes/projects/$projectId.tsx` has no feature-related preview-flow changes
- [ ] T040 Run `pnpm lint` from repository root
- [ ] T041 Run relevant Vitest command for generated source tests covering `src/features/ai-agent/source/init-source.server.test.ts`
- [ ] T042 Update `specs/006-axios-http-client/quickstart.md` only if implementation validation commands differ from the planned commands
- [ ] T043 Review final diff for `src/features/ai-agent/source/`, `src/features/ai-agent/code-tools/`, and `specs/006-axios-http-client/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion - MVP scope.
- **User Story 2 (Phase 4)**: Depends on Foundational completion and may build on the same generated HTTP client helper from US1.
- **User Story 3 (Phase 5)**: Depends on Foundational completion and can proceed after env key naming is agreed in US1.
- **Polish (Phase 6)**: Depends on desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Required MVP; establishes generated `src/services/http/client.ts` and axios metadata.
- **US2 (P2)**: Can be implemented after US1 helper exists; independently validates error/status behavior in generated source.
- **US3 (P3)**: Can be implemented after US1 env key usage is known; independently validates env template and prompt guidance.

### Parallel Opportunities

- T004-T007 can run in parallel because they inspect different files.
- T013-T015 can run in parallel because they add separate assertions in the same test file only if coordinated by one editor; otherwise serialize to avoid conflicts.
- T021-T023 can run in parallel because each targets a distinct generated HTTP behavior assertion; coordinate same test file edits.
- T029-T031 can run in parallel because prompt and generated-source assertions are separate concerns.
- T037-T039 can run in parallel because they verify separate preview boundary files.

---

## Parallel Example: User Story 1

```bash
Task: "Add failing test for generated src/services/http/client.ts existence in src/features/ai-agent/source/init-source.server.test.ts"
Task: "Add failing test for generated HTTP client exports and import alias compliance in src/features/ai-agent/source/init-source.server.test.ts"
Task: "Add failing test that generated package manifest contains axios ^1.16.0 in src/features/ai-agent/source/init-source.server.test.ts"
```

---

## Parallel Example: User Story 2

```bash
Task: "Add failing test for generated ApiError shape and toApiError helper in src/features/ai-agent/source/init-source.server.test.ts"
Task: "Add failing test for generated unauthorized retry guard fields and refresh skip behavior in src/features/ai-agent/source/init-source.server.test.ts"
Task: "Add failing test for generated token clearing behavior in src/features/ai-agent/source/init-source.server.test.ts"
```

---

## Parallel Example: User Story 3

```bash
Task: "Add failing test for generated .env.example API endpoint key in src/features/ai-agent/source/init-source.server.test.ts"
Task: "Add failing test that generated HTTP client consumes the same env key in src/features/ai-agent/source/init-source.server.test.ts"
Task: "Add failing test or assertion for HTTP setup prompt text in src/features/ai-agent/code-tools/code-agent-prompts.server.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 tasks T013-T020.
3. Stop and validate that generated projects include `src/services/http/client.ts` and axios `^1.16.0`.
4. Confirm preview files remain unchanged.

### Incremental Delivery

1. Deliver US1 for shared generated HTTP client baseline.
2. Deliver US2 for interceptor/status-code behavior.
3. Deliver US3 for `.env.example` and separated initialization prompt guidance.
4. Run full validation and preview non-regression checks.

### Parallel Team Strategy

1. One developer owns generated source changes in `src/features/ai-agent/source/init-source.server.ts`.
2. One developer owns tests in `src/features/ai-agent/source/init-source.server.test.ts`.
3. One developer owns prompt guidance in `src/features/ai-agent/code-tools/code-agent-prompts.server.ts`.
4. Preview boundary verification remains read-only and should not modify runtime or route preview files.

---

## Notes

- code-review-graph was requested before review, but the tool was unavailable in this request; fallback static source review was used and must be reattempted before implementation if the tool becomes available.
- [P] tasks are parallelizable only when they touch different files or when same-file edits are coordinated to avoid conflicts.
- Every user story has independent test criteria and can be validated from generated source output.
- Do not edit `.env` secret files; generate `.env.example` only.
- Do not modify preview runtime flow in `src/features/ai-agent/runtime/*` or preview UI behavior in `src/routes/projects/$projectId.tsx`.
