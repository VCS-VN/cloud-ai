# Tasks: AI Provider Thinking Layer

**Input**: Design documents from `/specs/001-thinking-layer/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are required because the specification and constitution require coverage for schema validation, business rules, repair/fallback, event sanitization, and orchestrator blocking.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or has no dependency on incomplete tasks
- **[Story]**: User story label for story phases only: `[US1]`, `[US2]`, `[US3]`
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared contracts and identify integration points without changing behavior.

- [X] T001 Review existing Thinking Layer exports and current test coverage in `src/features/ai-agent/thinking/thinking.schema.ts` and `src/features/ai-agent/thinking/thinking.test.ts`
- [X] T002 Review current agent stream event contract and orchestrator flow in `src/features/ai-agent/agent/agent-events.ts` and `src/features/ai-agent/agent/agent-orchestrator.server.ts`
- [X] T003 [P] Create structured Thinking Result provider schema file in `src/features/ai-agent/thinking/thinking-json-schema.ts`
- [X] T004 [P] Add Thinking Layer retry/confidence configuration in `src/features/ai-agent/thinking/thinking-config.ts`
- [X] T005 [P] Align developer prompt rules for structured Thinking analysis in `src/features/ai-agent/thinking/thinking.prompt.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define core contracts and validation primitives required by all user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Update Thinking Result, Thinking Input, and Agent Task schemas/types in `src/features/ai-agent/thinking/thinking.schema.ts`
- [X] T007 [P] Add business validation tests for contradictory init/modify, missing clarification question, stack change, destructive risk, uninitialized project, and missing affected features in `src/features/ai-agent/thinking/thinking.test.ts`
- [X] T008 Implement Thinking Result business validator in `src/features/ai-agent/thinking/thinking-business-validator.ts`
- [X] T009 [P] Add Agent Task mapping tests for all required mapped fields in `src/features/ai-agent/thinking/thinking.test.ts`
- [X] T010 Implement Thinking Result to Agent Task mapper in `src/features/ai-agent/thinking/thinking-to-agent-task.ts`
- [X] T011 [P] Add sanitized event mapper tests that verify raw prompt/provider fields are excluded in `src/features/ai-agent/thinking/thinking.test.ts`
- [X] T012 Update sanitized thinking event mapper in `src/features/ai-agent/thinking/thinking-events.mapper.ts`
- [X] T013 Ensure shared provider parsing errors remain redacted and safe in `src/features/ai-agent/openai/structured-output-parser.ts`

**Checkpoint**: Core schemas, business validation, mapping, and sanitized event primitives are ready for story implementation.

---

## Phase 3: User Story 1 - Understand Requests Before Acting (Priority: P1) 🎯 MVP

**Goal**: Every user prompt is analyzed into a validated Thinking Result and converted to an Agent Task before downstream builder stages run.

**Independent Test**: Submit init/update prompts through the Thinking Layer or orchestrator test seam and verify validated analysis completes before planner/source services receive an Agent Task.

### Tests for User Story 1

- [X] T014 [P] [US1] Add valid init_project Thinking Result schema acceptance test in `src/features/ai-agent/thinking/thinking.test.ts`
- [X] T015 [P] [US1] Add invalid Thinking Result missing-field rejection test in `src/features/ai-agent/thinking/thinking.test.ts`
- [X] T016 [P] [US1] Add provider structured-output success and parse-failure retry tests in `src/features/ai-agent/thinking/thinking.test.ts`
- [ ] T017 [P] [US1] Add orchestrator test proving planner/source execution waits for Thinking Result in `src/features/ai-agent/agent/agent-orchestrator.server.test.ts`

### Implementation for User Story 1

- [X] T018 [US1] Implement non-stream structured Thinking provider request in `src/features/ai-agent/thinking/thinking-service.server.ts`
- [X] T019 [US1] Implement Thinking Layer orchestration with schema validation, business validation, one repair attempt, and fallback in `src/features/ai-agent/thinking/thinking-orchestrator.server.ts`
- [X] T020 [US1] Implement clarification fallback Thinking Result creation in `src/features/ai-agent/thinking/thinking-fallback.ts`
- [X] T021 [US1] Build Thinking Input from project state, recent context, and runtime status in `src/features/ai-agent/thinking/thinking-runner.ts`
- [X] T022 [US1] Replace raw prompt planning handoff with Agent Task handoff in `src/features/ai-agent/agent/agent-orchestrator.server.ts`
- [X] T023 [US1] Route Agent Task into existing planner/source pipeline without reinterpreting raw provider output in `src/features/ai-agent/agent/agent-runner.server.ts`
- [X] T024 [US1] Persist safe Thinking summary for project runs in `src/features/ai-agent/project/project-run-store.server.ts`

**Checkpoint**: User Story 1 is complete when init/update prompts cannot reach planner/source services until a validated Thinking Result has been mapped to Agent Task.

---

## Phase 4: User Story 2 - Receive Safe Progress Updates (Priority: P2)

**Goal**: Users receive safe stream progress while analysis blocks internally, without raw provider output or hidden reasoning.

**Independent Test**: Send a prompt through the stream route and verify only sanitized thinking status and summary events are emitted.

### Tests for User Story 2

- [X] T025 [P] [US2] Add stream event contract tests for thinking_started, thinking_context_loaded, and thinking_completed in `src/features/ai-agent/agent/agent-events.test.ts`
- [X] T026 [P] [US2] Add UI reducer tests for sanitized thinking and clarification events in `src/features/ai-agent/ui/agent-event-reducer.test.ts`
- [X] T027 [P] [US2] Add provider delta non-forwarding regression test in `src/features/ai-agent/thinking/thinking.test.ts`

### Implementation for User Story 2

- [X] T028 [US2] Add sanitized thinking_started, thinking_context_loaded, thinking_completed, and clarification_required event types in `src/features/ai-agent/agent/agent-events.ts`
- [X] T029 [US2] Emit thinking_started and thinking_context_loaded before running the Thinking Layer in `src/features/ai-agent/agent/agent-orchestrator.server.ts`
- [X] T030 [US2] Emit thinking_completed from validated sanitized mapper output in `src/features/ai-agent/agent/agent-orchestrator.server.ts`
- [X] T031 [US2] Handle clarification_required event emission without continuing downstream pipeline in `src/features/ai-agent/agent/agent-orchestrator.server.ts`
- [X] T032 [US2] Update agent stream reducer for sanitized thinking events in `src/features/ai-agent/ui/agent-event-reducer.ts`
- [X] T033 [US2] Update agent timeline display labels for sanitized thinking events in `src/features/ai-agent/ui/agent-event-timeline.tsx`
- [X] T034 [US2] Ensure SSE serialization accepts new sanitized event types in `src/features/ai-agent/api/sse.server.ts`

**Checkpoint**: User Story 2 is complete when client stream consumers receive useful analysis progress and no raw provider content can appear in event payloads.

---

## Phase 5: User Story 3 - Stop Risky or Ambiguous Changes (Priority: P3)

**Goal**: Risky, destructive, stack-changing, low-confidence, or prompt-injection requests produce clarification or safe redirect outcomes and do not trigger planner/source execution.

**Independent Test**: Submit destructive, stack-changing, missing-integration, low-confidence, and prompt-injection prompts and verify clarification/error outcomes leave project state unchanged.

### Tests for User Story 3

- [X] T035 [P] [US3] Add destructive rebuild and stack-change clarification tests in `src/features/ai-agent/thinking/thinking.test.ts`
- [X] T036 [P] [US3] Add low-confidence clarification threshold tests in `src/features/ai-agent/thinking/thinking.test.ts`
- [X] T037 [P] [US3] Add prompt-injection risk and forbidden-action tests in `src/features/ai-agent/thinking/thinking.test.ts`
- [ ] T038 [P] [US3] Add orchestrator test proving clarification_required does not call planner/source services in `src/features/ai-agent/agent/agent-orchestrator.server.test.ts`
- [ ] T039 [P] [US3] Add provider timeout/malformed output no-state-mutation test in `src/features/ai-agent/agent/agent-orchestrator.server.test.ts`

### Implementation for User Story 3

- [X] T040 [US3] Add confidence threshold handling to Thinking Layer orchestration in `src/features/ai-agent/thinking/thinking-orchestrator.server.ts`
- [X] T041 [US3] Add prompt-injection and forbidden-action classification guidance in `src/features/ai-agent/thinking/thinking.prompt.ts`
- [X] T042 [US3] Ensure destructive and stack-change business rules force clarification in `src/features/ai-agent/thinking/thinking-business-validator.ts`
- [X] T043 [US3] Ensure provider timeout and malformed output return safe error or fallback without ProjectState mutation in `src/features/ai-agent/agent/agent-orchestrator.server.ts`
- [X] T044 [US3] Ensure project run status supports waiting_for_clarification and failed safe outcomes in `src/features/ai-agent/project/project-run-store.server.ts`

**Checkpoint**: User Story 3 is complete when risky prompts stop before downstream planning and produce safe client-visible outcomes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete observability, documentation alignment, and verification across stories.

- [X] T045 [P] Add Thinking Layer observability fields with redacted logs in `src/features/ai-agent/thinking/thinking-orchestrator.server.ts`
- [X] T046 [P] Update OpenAI provider tests for structured Thinking schema usage in `src/features/ai-agent/openai/openai-provider.test.ts`
- [X] T047 [P] Update implementation notes and manual scenarios in `specs/001-thinking-layer/quickstart.md`
- [X] T048 Run targeted Thinking Layer tests with `pnpm test -- src/features/ai-agent/thinking/thinking.test.ts`
- [ ] T049 Run targeted orchestrator/event tests with `pnpm test -- src/features/ai-agent/agent/agent-orchestrator.server.test.ts src/features/ai-agent/agent/agent-events.test.ts src/features/ai-agent/ui/agent-event-reducer.test.ts`
- [X] T050 Run repository typecheck with `pnpm typecheck`
- [X] T051 Run repository lint/format validation with `pnpm lint`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1 and blocks all user story work.
- **Phase 3 US1**: Depends on Phase 2. This is the MVP and enables validated analysis before downstream execution.
- **Phase 4 US2**: Depends on Phase 2 and can start after core event mapper/types exist; final orchestration emission depends on US1 orchestrator integration.
- **Phase 5 US3**: Depends on Phase 2 and can run in parallel with US2 after US1 establishes the blocking pipeline seam.
- **Phase 6 Polish**: Depends on completed user stories.

### User Story Dependencies

- **US1 → US2**: US2 uses validated Thinking Result and event mapper outputs created for US1.
- **US1 → US3**: US3 uses the Thinking Layer orchestration and downstream blocking seam created for US1.
- **US2 ↔ US3**: Mostly independent after US1; UI stream handling and risk handling can be implemented by separate agents if file ownership is coordinated.

### Within Each User Story

- Tests should be written before implementation tasks in the same story.
- Schema/provider/orchestrator tests can run in parallel when they touch different files.
- Orchestrator implementation tasks must follow Thinking service/mapper tasks.

---

## Parallel Execution Examples

### User Story 1

```text
Task A: T014 + T015 in src/features/ai-agent/thinking/thinking.test.ts
Task B: T016 in src/features/ai-agent/thinking/thinking.test.ts
Task C: T017 in src/features/ai-agent/agent/agent-orchestrator.server.test.ts
```

### User Story 2

```text
Task A: T025 in src/features/ai-agent/agent/agent-events.test.ts
Task B: T026 in src/features/ai-agent/ui/agent-event-reducer.test.ts
Task C: T027 in src/features/ai-agent/thinking/thinking.test.ts
```

### User Story 3

```text
Task A: T035 + T036 + T037 in src/features/ai-agent/thinking/thinking.test.ts
Task B: T038 + T039 in src/features/ai-agent/agent/agent-orchestrator.server.test.ts
Task C: T041 in src/features/ai-agent/thinking/thinking.prompt.ts
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 User Story 1.
3. Verify clear init/update prompts produce validated Thinking Results and Agent Tasks before downstream execution.
4. Stop for review if needed before adding stream/UI and advanced risk handling.

### Incremental Delivery

1. Deliver US1 to enforce the validated analysis boundary.
2. Deliver US2 to improve user-visible streaming safety.
3. Deliver US3 to strengthen ambiguity, destructive-change, and prompt-injection protection.
4. Complete polish tasks and full verification.

### Team Parallelization

- One contributor can own Thinking schemas/provider/validator files under `src/features/ai-agent/thinking/`.
- One contributor can own orchestrator/event integration under `src/features/ai-agent/agent/` and `src/features/ai-agent/api/`.
- One contributor can own UI reducer/timeline updates under `src/features/ai-agent/ui/`.
- Coordinate changes to `src/features/ai-agent/thinking/thinking.test.ts` because multiple story tests share that file.
