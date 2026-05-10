# Tasks: Preview Auto-Close

**Input**: Design documents from `/specs/003-preview-auto-close/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization for this feature

- [X] T001 [P] Create presence-service skeleton in src/features/ai-agent/runtime/presence-service.server.ts
- [X] T002 [P] Create heartbeat endpoint skeleton in src/routes/api/projects/$projectId/presence/heartbeat.ts
- [X] T003 [P] Create useUserPresence hook skeleton in src/hooks/useUserPresence.ts
- [X] T004 [P] Create PreviewInitPanel component skeleton in src/components/projects/PreviewInitPanel.tsx

**Checkpoint**: Setup complete - can begin user story implementation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core presence tracking infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 [US1] Implement PresenceService with in-memory Map for user tracking in src/features/ai-agent/runtime/presence-service.server.ts
- [X] T006 [US1] Add registerUser and unregisterUser methods to PresenceService
- [X] T007 [US1] Add heartbeat processing logic to PresenceService
- [X] T008 [US1] Implement idle timer logic (60s timeout) in PresenceService
- [X] T009 [US1] Integrate PresenceService with ProcessManager.stop() for auto-terminate
- [X] T010 [US1] Implement heartbeat API endpoint POST /api/projects/:projectId/presence/heartbeat
- [X] T011 [US1] Add authentication check to heartbeat endpoint
- [X] T012 [P] [US2] Create useUserPresence hook with visibility/focus tracking in src/hooks/useUserPresence.ts
- [X] T013 [US2] Implement heartbeat sender (every 30s) in useUserPresence hook
- [X] T014 [US2] Add cleanup on unmount in useUserPresence hook

**Checkpoint**: Foundational ready - user stories can now be implemented

---

## Phase 3: User Story 1 - Auto-close idle preview process (Priority: P1) 🎯 MVP

**Goal**: Server automatically terminates preview process when no users are viewing project detail

**Independent Test**: User navigates to project detail, starts preview, leaves page for 60s, verifies process terminates

### Implementation for User Story 1

- [X] T015 [US1] Wire heartbeat endpoint into project detail page loader/navigation
- [X] T016 [US1] Add presence tracking cleanup when user navigates away from project detail
- [ ] T017 [US1] Test auto-terminate flow: start preview → close tab → wait 90s → verify process stopped
- [ ] T018 [US1] Verify multiple users scenario: second user leaving doesn't terminate process

**Checkpoint**: User Story 1 fully functional and testable independently

---

## Phase 4: User Story 2 - Show preview initialization UI (Priority: P1)

**Goal**: Display friendly "Initializing preview..." UI when preview is starting

**Independent Test**: Click preview button and observe loading state is displayed during initialization

### Implementation for User Story 2

- [X] T019 [P] [US2] Create PreviewInitPanel component with idle state UI in src/components/projects/PreviewInitPanel.tsx
- [X] T020 [US2] Add "Start Preview" button using button-secondary pattern from DESIGN.md
- [X] T021 [US2] Add loading state with spinner and "Initializing preview..." text
- [X] T022 [US2] Implement isLoading prop and transition from idle → loading → ready
- [X] T023 [US2] Wire PreviewInitPanel into PreviewWorkspace in src/routes/projects/$projectId.tsx
- [X] T024 [US2] Show PreviewInitPanel when runtimeState.status === "idle" and no preview URL

**Checkpoint**: User Story 2 fully functional and testable independently

---

## Phase 5: User Story 3 - Manual preview trigger (Priority: P2)

**Goal**: Preview button appears when no preview process is running, allowing manual start

**Independent Test**: Navigate to project detail with no active preview, click preview button

### Implementation for User Story 3

- [X] T025 [P] [US3] Add startPreview handler to PreviewInitPanel
- [X] T026 [US3] Connect Start Preview button to runtime start mechanism
- [X] T027 [US3] Handle rapid click debounce in PreviewInitPanel
- [X] T028 [US3] Add error state display with retry button if preview fails to start
- [ ] T029 [US3] Test manual start flow: click button → see init UI → preview starts

**Checkpoint**: User Stories 1, 2, and 3 should all work independently

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T030 [P] Run ESLint to ensure code formatting compliance
- [X] T031 [P] Verify DESIGN.md token usage in PreviewInitPanel (colors, typography, spacing)
- [ ] T032 Test end-to-end flow: start preview → view → leave → verify terminated
- [ ] T033 Update AGENTS.md with new feature context if needed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - Uses US1 infrastructure
- **User Story 3 (P3)**: Can start after Foundational - Uses US1 infrastructure

### Within Each User Story

- Foundational (Phase 2) must complete first
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- T012 and T013 (useUserPresence hook parts) can run in parallel with server implementation
- T019 and T020 (PreviewInitPanel parts) can run in parallel with server implementation
- Once Foundational phase completes, all user stories can start in parallel

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Polish phase → Final validation

### Parallel Team Strategy

With multiple developers:

1. Developer A: Setup (Phase 1)
2. Once Setup done:
   - Developer A: Foundational server side (T005-T011)
   - Developer B: Foundational client side (T012-T014)
3. Once Foundational done:
   - Developer A: User Story 1
   - Developer B: User Story 2 + User Story 3

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- DESIGN.md tokens MUST be used for any UI changes (Constitution Principle V)
- Idle timeout: 60 seconds (FR-007)
- Heartbeat interval: 30 seconds (research.md)