# Tasks: Manual Preview Button for Inactive Projects

**Input**: Design documents from `/specs/004-preview-button/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/preview-contract.md, quickstart.md
**Tests**: Included for business rules and runtime/UI state transitions required by the constitution.
**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or independent tests
- **[Story]**: User story label from spec.md (`US1`, `US2`, `US3`)
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Context)

**Purpose**: Confirm existing preview/runtime/UI entry points before implementation.

- [X] T001 Review existing preview server function stubs in `src/server/functions/preview.ts`
- [X] T002 Review existing project service constructor and workspace helpers in `src/server/services/project-service.ts`
- [X] T003 Review service dependency wiring for runtime/process instances in `src/server/services/project-services.ts`
- [X] T004 [P] Review existing process lifecycle behavior in `src/features/ai-agent/runtime/process-manager.server.ts`
- [X] T005 [P] Review existing dev runtime event persistence flow in `src/features/ai-agent/runtime/runtime-service.server.ts`
- [X] T006 [P] Review existing dev runtime storage helpers in `src/features/ai-agent/project/project-state-store.server.ts`
- [X] T007 [P] Review project detail preview rendering logic in `src/routes/projects/$projectId.tsx`
- [X] T008 [P] Review preview start panel behavior and DESIGN.md token usage in `src/components/projects/PreviewInitPanel.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared server runtime behavior, duplicate prevention, service contracts, and business-rule tests required by all user stories.

**Critical**: No user story work should begin until this phase is complete.

- [X] T009 Update shared runtime dependency wiring so `ProcessManager` is reused across service calls in `src/server/services/project-services.ts`
- [X] T010 Update service wiring to inject `RuntimeService` into `ProjectService` in `src/server/services/project-services.ts`
- [X] T011 Update `ProjectService` constructor to accept `RuntimeService` in `src/server/services/project-service.ts`
- [X] T012 Await existing process shutdown before spawning a replacement in `src/features/ai-agent/runtime/process-manager.server.ts`
- [X] T013 Implement `ProjectService.getDevRuntimeState(projectId, userId)` with ownership validation in `src/server/services/project-service.ts`
- [X] T014 Implement stale runtime normalization when persisted state is running but `ProcessManager.isRunning(projectId)` is false in `src/server/services/project-service.ts`
- [X] T015 Implement `ProjectService.startPreview(projectId, userId)` with ownership validation in `src/server/services/project-service.ts`
- [X] T016 Implement duplicate-process prevention and already-running response in `ProjectService.startPreview` in `src/server/services/project-service.ts`
- [X] T017 Implement manual preview start by delegating to `RuntimeService.runPostInitDev()` in `src/server/services/project-service.ts`
- [X] T018 Normalize `ProjectService.startPreview` success and failure responses to the preview contract in `src/server/services/project-service.ts`
- [X] T019 Tighten `projectId` input validation for `getDevRuntimeState` and `startPreview` in `src/server/functions/preview.ts`
- [ ] T020 [P] Add unit tests for `ProjectService.getDevRuntimeState` ownership, empty state, running state, and stale running state in `src/server/services/project-service.test.ts`
- [ ] T021 [P] Add unit tests for `ProjectService.startPreview` project-not-found, already-running, dev-ready, dev-error, and duplicate prevention behavior in `src/server/services/project-service.test.ts`
- [ ] T022 [P] Add runtime service tests for starting, running, and error persistence in `src/features/ai-agent/runtime/runtime-service.server.test.ts`
- [ ] T023 [P] Add project state store tests for reading default runtime and saving runtime updates in `src/features/ai-agent/project/project-state-store.server.test.ts`

**Checkpoint**: Server foundation ready. User story implementation can begin.

---

## Phase 3: User Story 1 - Start Preview from Project Detail (Priority: P1) MVP

**Goal**: User can click Start Preview from a project detail page with no running dev server and automatically see the preview UI after the server starts.

**Independent Test**: Navigate to a project without an active preview, click Start Preview, verify loading feedback appears, then verify the iframe loads when the server returns a preview URL.

### Implementation for User Story 1

- [X] T024 [US1] Import `startPreview` from `@/server/functions/preview` and bind it with `useServerFn` in `src/routes/projects/$projectId.tsx`
- [X] T025 [US1] Add route-level `previewStarting` and `previewStartError` state in `src/routes/projects/$projectId.tsx`
- [X] T026 [US1] Implement `handleStartPreview` to call `startPreview`, guard duplicate clicks, set loading/error state, and handle success in `src/routes/projects/$projectId.tsx`
- [X] T027 [US1] Refresh route/workspace data after successful preview start in `src/routes/projects/$projectId.tsx`
- [X] T028 [US1] Extend `PreviewWorkspace` props for `onStartPreview`, `previewStarting`, and `previewStartError` in `src/routes/projects/$projectId.tsx`
- [X] T029 [US1] Pass manual start handlers and state from `ProjectDetailPage` to `PreviewWorkspace` in `src/routes/projects/$projectId.tsx`
- [X] T030 [US1] Wire `PreviewInitPanel` to the real `onStartPreview`, `isLoading`, `error`, and retry props in `src/routes/projects/$projectId.tsx`
- [X] T031 [US1] Ensure successful start displays the iframe from updated `runtimeState.previewUrl` in `src/routes/projects/$projectId.tsx`
- [X] T032 [US1] Make parent `isLoading` the authoritative loading source and remove permanent local starting state in `src/components/projects/PreviewInitPanel.tsx`
- [X] T033 [US1] Disable the Start Preview button while loading and keep Retry available after errors in `src/components/projects/PreviewInitPanel.tsx`
- [X] T034 [US1] Verify Start Preview button styling follows DESIGN.md pill/button token expectations in `src/components/projects/PreviewInitPanel.tsx`
- [ ] T035 [P] [US1] Add component test for loading state and double-click prevention in `src/components/projects/PreviewInitPanel.test.tsx`
- [ ] T036 [P] [US1] Add component test for error display and retry behavior in `src/components/projects/PreviewInitPanel.test.tsx`
- [ ] T037 [P] [US1] Add route test for successful start refreshing workspace state and showing the iframe in `src/routes/projects/$projectId.test.tsx`

**Checkpoint**: US1 should be fully functional and independently testable.

---

## Phase 4: User Story 2 - Auto-Open Preview When Process Already Exists (Priority: P2)

**Goal**: User navigates to a project with an existing running preview process and the preview UI opens automatically without clicking Start Preview.

**Independent Test**: Seed or mock a running `devRuntime` with `previewUrl`, navigate to the project detail page, and verify the iframe appears and no start button is required.

### Implementation for User Story 2

- [X] T038 [US2] Import `getDevRuntimeState` from `@/server/functions/preview` and bind it with `useServerFn` in `src/routes/projects/$projectId.tsx`
- [X] T039 [US2] Add existing-process runtime refresh on project load when workspace runtime may be stale in `src/routes/projects/$projectId.tsx`
- [X] T040 [US2] Merge refreshed dev runtime into `runtimeState` without breaking streamed agent event reduction in `src/routes/projects/$projectId.tsx`
- [X] T041 [US2] Ensure `PreviewWorkspace` renders the iframe automatically when `runtimeState.status === "running"` and `runtimeState.previewUrl` exists in `src/routes/projects/$projectId.tsx`
- [X] T042 [US2] Ensure the preview toolbar external link uses the same running `previewUrl` in `src/routes/projects/$projectId.tsx`
- [ ] T043 [P] [US2] Add route test for auto-rendering iframe when `devRuntime.status` is `running` in `src/routes/projects/$projectId.test.tsx`
- [ ] T044 [P] [US2] Add route test that Start Preview is not visible when `devRuntime.status` is `running` in `src/routes/projects/$projectId.test.tsx`

**Checkpoint**: US2 should auto-open an existing preview independently of US1 click behavior.

---

## Phase 5: User Story 3 - Preview Button Visibility Based on Process State (Priority: P3)

**Goal**: Preview button visibility accurately follows project dev runtime state so users only see start/retry controls when no process is running.

**Independent Test**: Toggle mocked runtime states and verify the start button, retry state, loading state, iframe, and toolbar link match each state.

### Implementation for User Story 3

- [X] T045 [US3] Update `mapDevRuntimeStatus` or related state mapping to handle `stopped` consistently as a non-running state in `src/routes/projects/$projectId.tsx`
- [X] T046 [US3] Update `PreviewWorkspace` inactive-state logic to show `PreviewInitPanel` for idle or stopped states without a `previewUrl` in `src/routes/projects/$projectId.tsx`
- [X] T047 [US3] Update `PreviewWorkspace` error-state logic to show retry UI through `PreviewInitPanel` when start failed in `src/routes/projects/$projectId.tsx`
- [X] T048 [US3] Ensure transitional states such as installing, installed, and starting do not show duplicate start controls in `src/routes/projects/$projectId.tsx`
- [X] T049 [US3] Ensure `PreviewToolbar` shows disabled external-link behavior when no `previewUrl` exists in `src/routes/projects/$projectId.tsx`
- [ ] T050 [P] [US3] Add route test showing Start Preview for idle runtime state in `src/routes/projects/$projectId.test.tsx`
- [ ] T051 [P] [US3] Add route test showing Start Preview for stopped runtime state in `src/routes/projects/$projectId.test.tsx`
- [ ] T052 [P] [US3] Add route test showing retry UI for error runtime state in `src/routes/projects/$projectId.test.tsx`
- [ ] T053 [P] [US3] Add route test hiding Start Preview for running runtime state in `src/routes/projects/$projectId.test.tsx`
- [ ] T054 [P] [US3] Add route test hiding duplicate start controls for starting runtime state in `src/routes/projects/$projectId.test.tsx`

**Checkpoint**: US3 should fully validate visibility across relevant runtime states.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate quality, formatting, and manual acceptance flows across UI and server.

- [X] T055 Run TypeScript checks for the repository using the project package script in `package.json`
- [ ] T056 Run linting for the repository using the project package script in `package.json`
- [ ] T057 Run formatting or formatter check according to repository conventions in `package.json`
- [ ] T058 Run service-layer tests covering preview runtime business rules in `src/server/services/project-service.test.ts`
- [ ] T059 Run runtime/state tests covering dev runtime persistence in `src/features/ai-agent/runtime/runtime-service.server.test.ts`
- [ ] T060 Run UI tests covering PreviewInitPanel and project preview route behavior in `src/components/projects/PreviewInitPanel.test.tsx` and `src/routes/projects/$projectId.test.tsx`
- [ ] T061 Manually verify inactive project shows Start Preview using `specs/004-preview-button/quickstart.md`
- [ ] T062 Manually verify clicking Start Preview shows loading feedback using `specs/004-preview-button/quickstart.md`
- [ ] T063 Manually verify successful start loads the iframe using `specs/004-preview-button/quickstart.md`
- [ ] T064 Manually verify navigating away and back auto-loads an existing preview using `specs/004-preview-button/quickstart.md`
- [ ] T065 Manually verify preview start failure shows clear error and Retry using `specs/004-preview-button/quickstart.md`
- [ ] T066 Manually verify rapid double-click does not create duplicate processes using `specs/004-preview-button/quickstart.md`
- [X] T067 Verify no database schema changes were introduced in `src/db/schema/project-states.schema.ts`
- [X] T068 Verify imports follow `@/` alias rules in changed files under `src/`
- [X] T069 Verify UI color, typography, spacing, and pill-button styling follow `DESIGN.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational completion; provides MVP.
- **US2 (Phase 4)**: Depends on Foundational completion and can be implemented after or alongside US1 route wiring.
- **US3 (Phase 5)**: Depends on route/runtime state shape established by US1 and US2.
- **Polish (Phase 6)**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1**: No dependency on US2 or US3 after Foundation; MVP scope.
- **US2**: Depends on reliable `getDevRuntimeState` and runtime state merge; can be tested independently with running runtime state.
- **US3**: Depends on final status mapping and rendering rules; verifies visibility behavior across all states.

### Critical Task Dependencies

- T011 depends on T010.
- T013 and T015 depend on T011.
- T016 depends on T013 and T015.
- T017 depends on T010, T011, and T015.
- T018 depends on T016 and T017.
- T024-T031 depend on T015-T019.
- T032-T034 depend on T028-T030.
- T038-T042 depend on T013 and T019.
- T045-T049 depend on T024-T031 and T038-T042.

---

## Parallel Execution Examples

### Three Sub-Agent Split

```text
UI sub-agent:
T024-T034, T038-T049, T035-T037, T043-T044, T050-T054

Server sub-agent:
T009-T019, T020-T023

Synthesis/QA sub-agent:
T055-T069, dependency validation, quickstart verification, final summary
```

### Parallel Example: Foundation

```text
Task: "Add service tests in src/server/services/project-service.test.ts" → T020, T021
Task: "Add runtime service tests in src/features/ai-agent/runtime/runtime-service.server.test.ts" → T022
Task: "Add project state store tests in src/features/ai-agent/project/project-state-store.server.test.ts" → T023
```

### Parallel Example: US1

```text
Task: "Wire route startPreview flow in src/routes/projects/$projectId.tsx" → T024-T031
Task: "Adjust PreviewInitPanel parent-controlled loading in src/components/projects/PreviewInitPanel.tsx" → T032-T034
Task: "Add UI tests in PreviewInitPanel.test.tsx and $projectId.test.tsx" → T035-T037
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1 setup review.
2. Complete Phase 2 server foundation and business-rule tests.
3. Complete Phase 3 US1 route/UI wiring.
4. Stop and validate: inactive project shows Start Preview, click starts preview, iframe loads on success, error/retry works on failure.

### Incremental Delivery

1. Deliver US1 as the MVP.
2. Add US2 to auto-open existing running previews.
3. Add US3 to refine visibility for idle/stopped/error/starting/running states.
4. Run Phase 6 verification before implementation completion.

### Notes

- No database migration should be created for this feature.
- Reuse `RuntimeService.runPostInitDev()` rather than directly spawning from the server function.
- Prevent duplicate processes with both persisted `devRuntime` and `ProcessManager.isRunning(projectId)` checks.
- Keep preview auto-close and agentic tool changes out of scope.
