# Tasks: Code Tool Calling Runtime

**Input**: Design documents from `/specs/011-code-tool-runtime/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because the specification and constitution require validation of safety-critical business rules: path guarding, inspect-before-mutate, patch blocking, validation allowlist, recoverable streaming, rollback, and human-review triggers.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the Code Tool Runtime bounded area and shared test fixtures without changing behavior.

- [X] T001 Create code tool runtime directories in `src/features/ai-agent/code-tools/tools` and `src/features/ai-agent/code-tools/services`
- [X] T002 Create barrel-safe runtime type placeholders in `src/features/ai-agent/code-tools/code-agent-types.ts`
- [X] T003 [P] Create code agent developer prompt placeholder in `src/features/ai-agent/code-tools/code-agent-prompts.server.ts`
- [X] T004 [P] Create shared test fixture helpers in `src/features/ai-agent/code-tools/code-tools.test-utils.ts`
- [X] T005 [P] Add feature quickstart reference notes in `specs/011-code-tool-runtime/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core contracts, limits, phase policy, and persistence primitives that MUST be complete before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Define `CodeToolCategory`, `CodeToolDefinition`, `ProjectToolResult`, `ToolExecutionContext`, and provider call types in `src/features/ai-agent/code-tools/code-agent-types.ts`
- [X] T007 Define code tool limits and phase allowlist helpers in `src/features/ai-agent/code-tools/code-tool-registry.server.ts`
- [X] T008 [P] Define sanitized code tool event types and event summary helpers in `src/features/ai-agent/code-tools/code-tool-events.server.ts`
- [X] T009 [P] Add tool execution log schema in `src/db/schema/project-tool-execution-logs.schema.ts`
- [X] T010 [P] Add message run state schema updates in `src/db/schema/agent-runs.schema.ts`
- [X] T011 Wire new schemas into `src/db/schema.ts`
- [X] T012 Create migration for tool logs and message run state fields in `src/db/migrations/0007_code_tool_runtime.sql`
- [X] T013 [P] Implement tool execution log repository methods in `src/server/repositories/agent-run-repository.ts`
- [X] T014 [P] Implement message run state repository methods in `src/features/ai-agent/project/project-run-store.server.ts`
- [X] T015 Define provider function tool schema builder in `src/features/ai-agent/code-tools/code-tool-registry.server.ts`
- [X] T016 Define soft argument normalization helpers in `src/features/ai-agent/code-tools/code-tool-executor.server.ts`
- [X] T017 Define tool safety result helpers and structured recoverable errors in `src/features/ai-agent/code-tools/code-tool-executor.server.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in priority order or parallel by story.

---

## Phase 3: User Story 1 - Safe Project Inspection Before Change (Priority: P1) 🎯 MVP

**Goal**: The agent can inspect trusted project context, file tree/search results, and source files before any mutation is allowed.

**Independent Test**: Submit or simulate a UI change run and verify successful context/discovery/read tool results occur before mutation tools are accepted; unsafe external paths are blocked without reading files.

### Tests for User Story 1

- [x] T018 [P] [US1] Add path guard tests for traversal, absolute paths, forbidden files, and allowed relative paths in `src/features/ai-agent/code-tools/services/project-path-guard.server.test.ts`
- [x] T019 [P] [US1] Add inspect-before-mutate executor tests in `src/features/ai-agent/code-tools/code-tool-executor.server.test.ts`
- [x] T020 [P] [US1] Add inspection tool contract tests in `src/features/ai-agent/code-tools/tools/project-inspection-tools.test.ts`

### Implementation for User Story 1

- [x] T021 [P] [US1] Implement project workspace resolver in `src/features/ai-agent/code-tools/services/project-workspace.server.ts`
- [x] T022 [P] [US1] Implement generated project path guard and forbidden path policy in `src/features/ai-agent/code-tools/services/project-path-guard.server.ts`
- [x] T023 [P] [US1] Implement secret redaction wrapper for tool outputs in `src/features/ai-agent/code-tools/services/secret-redaction.server.ts`
- [x] T024 [US1] Implement project context tool in `src/features/ai-agent/code-tools/tools/project-get-context.tool.server.ts`
- [x] T025 [US1] Implement safe file tree tool in `src/features/ai-agent/code-tools/tools/project-get-file-tree.tool.server.ts`
- [x] T026 [US1] Implement code search service in `src/features/ai-agent/code-tools/services/project-code-search.server.ts`
- [x] T027 [US1] Implement code search tool in `src/features/ai-agent/code-tools/tools/project-search-code.tool.server.ts`
- [x] T028 [US1] Implement project file reader service in `src/features/ai-agent/code-tools/services/project-file-reader.server.ts`
- [x] T029 [US1] Implement full file read tool in `src/features/ai-agent/code-tools/tools/project-read-file.tool.server.ts`
- [x] T030 [US1] Implement file range read tool in `src/features/ai-agent/code-tools/tools/project-read-file-range.tool.server.ts`
- [x] T031 [US1] Register inspection tools in `src/features/ai-agent/code-tools/code-tool-registry.server.ts`
- [x] T032 [US1] Enforce trusted context binding and inspection phase gates in `src/features/ai-agent/code-tools/code-tool-executor.server.ts`

**Checkpoint**: User Story 1 is independently functional when inspection tools work, unsafe reads are blocked, and mutation before inspection is rejected.

---

## Phase 4: User Story 2 - Auditable Patch-Based Code Changes (Priority: P1)

**Goal**: The agent can request scoped, snapshot-backed, auditable patch changes after inspection.

**Independent Test**: Submit or simulate a known component change and verify snapshot creation, patch validation, minimal changed-file summary, diff availability, and blocked forbidden paths.

### Tests for User Story 2

- [X] T033 [P] [US2] Add snapshot service tests for create and rollback behavior in `src/features/ai-agent/code-tools/services/project-snapshot-service.server.test.ts`
- [X] T034 [P] [US2] Add patch policy tests for forbidden paths, protected files, package policy, patch size, and changed-file limits in `src/features/ai-agent/code-tools/services/project-patch-service.server.test.ts`
- [X] T035 [P] [US2] Add mutation tool contract tests in `src/features/ai-agent/code-tools/tools/project-mutation-tools.test.ts`

### Implementation for User Story 2

- [X] T036 [P] [US2] Implement snapshot adapter service in `src/features/ai-agent/code-tools/services/project-snapshot-service.server.ts`
- [X] T037 [US2] Implement snapshot creation tool in `src/features/ai-agent/code-tools/tools/project-create-snapshot.tool.server.ts`
- [X] T038 [US2] Implement rollback snapshot tool in `src/features/ai-agent/code-tools/tools/project-rollback-snapshot.tool.server.ts`
- [X] T039 [P] [US2] Implement patch validation and metrics service in `src/features/ai-agent/code-tools/services/project-patch-service.server.ts`
- [X] T040 [US2] Implement unified patch apply tool in `src/features/ai-agent/code-tools/tools/project-apply-patch.tool.server.ts`
- [X] T041 [US2] Implement create file tool in `src/features/ai-agent/code-tools/tools/project-create-file.tool.server.ts`
- [X] T042 [US2] Implement current run diff tool in `src/features/ai-agent/code-tools/tools/project-get-diff.tool.server.ts`
- [X] T043 [US2] Register snapshot and mutation tools in `src/features/ai-agent/code-tools/code-tool-registry.server.ts`
- [X] T044 [US2] Enforce snapshot-before-first-mutation in `src/features/ai-agent/code-tools/code-tool-executor.server.ts`
- [X] T045 [US2] Persist patch result changed files and snapshot identity in `src/features/ai-agent/project/project-run-store.server.ts`

**Checkpoint**: User Story 2 is independently functional when inspected runs can snapshot, patch, diff, and rollback while unsafe patch targets are blocked.

---

## Phase 5: User Story 3 - Resilient Validation and Repair Flow (Priority: P2)

**Goal**: Mutated runs execute safe validation, attempt bounded repair for common failures, and stop with rollback or human review when repair is exhausted.

**Independent Test**: Apply a controlled failing change and verify validation failure is summarized, repair attempts are bounded, and final status is passed, rolled back, or human-review required.

### Tests for User Story 3

- [x] T046 [P] [US3] Add command allowlist tests in `src/features/ai-agent/code-tools/services/command-allowlist.server.test.ts`
- [x] T047 [P] [US3] Add validation service tests for passed, failed, skipped, redacted, and truncated outputs in `src/features/ai-agent/code-tools/services/project-validation-service.server.test.ts`
- [x] T048 [P] [US3] Add repair loop tests for max attempts and rollback handoff in `src/features/ai-agent/code-tools/code-tool-loop.server.test.ts`

### Implementation for User Story 3

- [x] T049 [P] [US3] Implement validation command allowlist in `src/features/ai-agent/code-tools/services/command-allowlist.server.ts`
- [x] T050 [US3] Implement project validation service in `src/features/ai-agent/code-tools/services/project-validation-service.server.ts`
- [X] T051 [US3] Implement validation tool in `src/features/ai-agent/code-tools/tools/project-run-validation.tool.server.ts`
- [x] T052 [US3] Add validation event mapping in `src/features/ai-agent/code-tools/code-tool-events.server.ts`
- [x] T053 [US3] Implement bounded code tool loop with validation and repair transitions in `src/features/ai-agent/code-tools/code-tool-loop.server.ts`
- [x] T054 [US3] Integrate rollback-on-exhausted-repair behavior in `src/features/ai-agent/code-tools/code-tool-loop.server.ts`
- [x] T055 [US3] Persist validation status and repair phase updates in `src/features/ai-agent/project/project-run-store.server.ts`

**Checkpoint**: User Story 3 is independently functional when mutation runs validate, repair within budget, and safely stop on unrecoverable validation failures.

---

## Phase 6: User Story 4 - Sanitized Streaming Progress (Priority: P2)

**Goal**: Client streams show safe, useful progress for code tool runs without exposing private reasoning, secrets, full files, raw patches, or full logs.

**Independent Test**: Run a message and verify lifecycle, tool, patch, validation, repair, preview, completion, and recoverable error events are present and sanitized.

### Tests for User Story 4

- [x] T056 [P] [US4] Add stream event sanitizer tests in `src/features/ai-agent/code-tools/code-tool-events.server.test.ts`
- [x] T057 [P] [US4] Add UI reducer tests for code tool events in `src/features/ai-agent/ui/agent-event-reducer.test.ts`
- [X] T058 [P] [US4] Add message stream integration test for recoverable tool errors in `src/features/ai-agent/agent/agent-runner.server.test.ts`

### Implementation for User Story 4

- [x] T059 [US4] Add code tool event variants to agent event model in `src/features/ai-agent/agent/agent-events.ts`
- [x] T060 [US4] Implement tool call requested/completed sanitizers in `src/features/ai-agent/code-tools/code-tool-events.server.ts`
- [x] T061 [US4] Implement patch, validation, repair, preview, completion, and human-review event builders in `src/features/ai-agent/code-tools/code-tool-events.server.ts`
- [X] T062 [US4] Integrate code tool stream events into runner stream writer in `src/features/ai-agent/agent/agent-runner.server.ts`
- [x] T063 [US4] Update server message stream function to preserve stream on recoverable code tool errors in `src/server/functions/project-message-stream.ts`
- [x] T064 [US4] Update client event reducer handling for code tool event variants in `src/features/ai-agent/ui/agent-event-reducer.ts`
- [x] T065 [US4] Update agent timeline rendering for sanitized code tool progress in `src/features/ai-agent/ui/agent-event-timeline.tsx`

**Checkpoint**: User Story 4 is independently functional when clients receive sanitized progress and recoverable tool issues do not break the stream.

---

## Phase 7: User Story 5 - Human Review for High-Risk Requests (Priority: P3)

**Goal**: Broad, destructive, excessive, or sensitive changes stop with human review instead of automatic mutation.

**Independent Test**: Submit or simulate requests to delete major source areas, switch project foundation, or change too many files and confirm no automatic mutation occurs.

### Tests for User Story 5

- [x] T066 [P] [US5] Add high-risk policy tests in `src/features/ai-agent/code-tools/services/project-risk-policy.server.test.ts`
- [x] T067 [P] [US5] Add human review transition tests in `src/features/ai-agent/code-tools/code-tool-loop.server.test.ts`

### Implementation for User Story 5

- [x] T068 [P] [US5] Implement high-risk and human-review policy service in `src/features/ai-agent/code-tools/services/project-risk-policy.server.ts`
- [X] T069 [US5] Apply high-risk policy before mutation execution in `src/features/ai-agent/code-tools/code-tool-executor.server.ts`
- [X] T070 [US5] Apply max changed files and sensitive-area policy in `src/features/ai-agent/code-tools/services/project-patch-service.server.ts`
- [x] T071 [US5] Emit and persist human review required final state in `src/features/ai-agent/code-tools/code-tool-loop.server.ts`
- [x] T072 [US5] Surface human review status in message run state in `src/features/ai-agent/project/project-run-store.server.ts`

**Checkpoint**: User Story 5 is independently functional when high-risk requests produce `human_review_required` with no automatic file mutation.

---

## Phase 8: Integration & Cross-Cutting Concerns

**Purpose**: Connect the runtime into the existing message flow, update provider integration, and verify the full quickstart path.

- [X] T073 Integrate initial code agent input and developer prompt construction in `src/features/ai-agent/code-tools/code-agent-prompts.server.ts`
- [X] T074 Integrate OpenAI Responses function-tool calls and outputs in `src/features/ai-agent/openai/openai-provider.server.ts`
- [X] T075 Integrate code tool loop after thinking task creation in `src/features/ai-agent/agent/agent-runner.server.ts`
- [X] T076 Integrate project mutation lock acquisition around message execution in `src/features/ai-agent/agent/agent-runner.server.ts`
- [X] T077 Add preview restart policy service in `src/features/ai-agent/code-tools/services/preview-restart-policy.server.ts`
- [X] T078 Integrate preview restart-required detection after patch results in `src/features/ai-agent/code-tools/code-tool-loop.server.ts`
- [X] T079 Append code change records to project state in `src/features/ai-agent/project/project-state-store.server.ts`
- [X] T080 Update file manifest handling for created/deleted files in `src/features/ai-agent/project/project-state-store.server.ts`
- [X] T081 Add end-to-end happy path test for wishlist-style code tool run in `src/features/ai-agent/agent/agent-runner.server.test.ts`
- [X] T082 Add quickstart manual verification notes after implementation in `specs/011-code-tool-runtime/quickstart.md`

---

## Phase 9: Polish & Validation

**Purpose**: Final checks, documentation, and quality gates across all stories.

- [X] T083 [P] Update code tool contracts if implementation names or payloads changed in `specs/011-code-tool-runtime/contracts/code-tools.contract.md`
- [X] T084 [P] Update stream event contract if final event payloads changed in `specs/011-code-tool-runtime/contracts/stream-events.contract.md`
- [X] T085 [P] Add developer notes for runtime architecture in `src/features/ai-agent/code-tools/README.md`
- [ ] T086 Run `pnpm test` and fix only failures caused by this feature
- [X] T087 Run `pnpm typecheck` and fix only failures caused by this feature
- [X] T088 Run `pnpm lint` and fix only failures caused by this feature
- [X] T089 Run `pnpm build` and fix only failures caused by this feature
- [X] T090 Perform code-graph impact review for AI agent runtime changes and record findings in `specs/011-code-tool-runtime/tasks.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **US1 Safe Inspection (Phase 3)**: Depends on Foundational; MVP scope.
- **US2 Patch Changes (Phase 4)**: Depends on US1 because mutation requires inspection and path safety.
- **US3 Validation/Repair (Phase 5)**: Depends on US2 because validation follows mutation.
- **US4 Sanitized Streaming (Phase 6)**: Depends on Foundational and can start after US1 event primitives exist; full completion depends on US2/US3 event producers.
- **US5 Human Review (Phase 7)**: Depends on US2 patch policy and can be implemented before or after US3.
- **Integration (Phase 8)**: Depends on US1-US5 core behavior.
- **Polish (Phase 9)**: Depends on desired stories and integration being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies after Foundational; MVP.
- **User Story 2 (P1)**: Depends on US1 inspection and executor gates.
- **User Story 3 (P2)**: Depends on US2 mutation and snapshot behavior.
- **User Story 4 (P2)**: Can begin after Foundational, but final event coverage depends on US1-US3.
- **User Story 5 (P3)**: Depends on US2 patch policy and executor integration.

### Within Each User Story

- Tests should be written first and fail before implementation.
- Services and policies should be implemented before tools that call them.
- Tools should be registered after service behavior exists.
- Runner/provider integration should wait until story-level behavior is covered.

### Parallel Opportunities

- T003-T005 can run in parallel after T001-T002.
- T008-T010 and T013-T014 can run in parallel during Foundational work.
- US1 tests T018-T020 can run in parallel before US1 implementation.
- US1 services T021-T023 can run in parallel before tools T024-T030.
- US2 tests T033-T035 and services T036/T039 can run in parallel.
- US3 tests T046-T048 can run in parallel before validation implementation.
- US4 tests T056-T058 can run in parallel before event implementation.
- US5 tests T066-T067 and policy service T068 can run in parallel with late US3 work.
- Documentation updates T083-T085 can run in parallel during Polish.

---

## Parallel Example: User Story 1

```bash
Task: "Add path guard tests for traversal, absolute paths, forbidden files, and allowed relative paths in src/features/ai-agent/code-tools/services/project-path-guard.server.test.ts"
Task: "Add inspect-before-mutate executor tests in src/features/ai-agent/code-tools/code-tool-executor.server.test.ts"
Task: "Add inspection tool contract tests in src/features/ai-agent/code-tools/tools/project-inspection-tools.test.ts"
Task: "Implement project workspace resolver in src/features/ai-agent/code-tools/services/project-workspace.server.ts"
Task: "Implement generated project path guard and forbidden path policy in src/features/ai-agent/code-tools/services/project-path-guard.server.ts"
Task: "Implement secret redaction wrapper for tool outputs in src/features/ai-agent/code-tools/services/secret-redaction.server.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Add snapshot service tests for create and rollback behavior in src/features/ai-agent/code-tools/services/project-snapshot-service.server.test.ts"
Task: "Add patch policy tests for forbidden paths, protected files, package policy, patch size, and changed-file limits in src/features/ai-agent/code-tools/services/project-patch-service.server.test.ts"
Task: "Implement snapshot adapter service in src/features/ai-agent/code-tools/services/project-snapshot-service.server.ts"
Task: "Implement patch validation and metrics service in src/features/ai-agent/code-tools/services/project-patch-service.server.ts"
```

## Parallel Example: User Story 4

```bash
Task: "Add stream event sanitizer tests in src/features/ai-agent/code-tools/code-tool-events.server.test.ts"
Task: "Add UI reducer tests for code tool events in src/features/ai-agent/ui/agent-event-reducer.test.ts"
Task: "Add message stream integration test for recoverable tool errors in src/features/ai-agent/agent/agent-runner.server.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate that project inspection works and mutation before inspection is blocked.
5. Demo safe inspection events before any file mutation support is enabled.

### Incremental Delivery

1. Deliver US1 for safe read-only inspection.
2. Add US2 for snapshot-backed patch mutation.
3. Add US3 for validation and bounded repair.
4. Add US4 for full sanitized client streaming.
5. Add US5 for high-risk human review policy.
6. Complete integration and polish phases.

### Parallel Team Strategy

1. Team completes Setup and Foundational together.
2. Developer A owns US1 inspection and path safety.
3. Developer B starts US4 event contracts/reducer after foundational event types exist.
4. Developer C starts US2 snapshot/patch services after US1 path guard stabilizes.
5. Developer D starts US3 validation services once mutation result contracts are stable.
6. Developer E starts US5 risk policy once patch policy interfaces are available.

## Notes

- Keep changes surgical and avoid moving existing AI agent files unless required.
- Do not expose arbitrary shell execution to the provider.
- Do not trust provider-supplied project identity or paths.
- Preserve recoverable stream behavior for safe tool failures.
- Run code-graph impact review before final implementation review.

## Implementation Notes

- Code-graph impact review completed on 2026-05-09: medium risk (0.65), priorities around AgentEventTimeline, run-store mapping, and event detail rendering.

- Full `pnpm test -- --run` attempted on 2026-05-09 but hangs during `.server.test.ts` collection with 0-test import-protection behavior; targeted UI/runner-adjacent tests plus typecheck/lint/build were used for validation.
