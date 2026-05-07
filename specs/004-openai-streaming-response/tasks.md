# Tasks: AI Streaming Responses

**Input**: Design documents from `specs/004-openai-streaming-response/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/project-message-streaming.md, quickstart.md
**Tests**: Include focused Vitest coverage for business rules, provider mapping, and server contracts because the constitution requires tests for important business rules.
**Organization**: Tasks are grouped by user story while preserving the requested implementation phrases: database, AI provider setup, server function, network, client UI, and client/server action flows.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other marked tasks in the same phase because it touches different files and has no dependency on incomplete tasks.
- **[Story]**: Applies only to user-story phases.
- Every task includes an exact repository file path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature constants, environment documentation, and test scaffolding without changing runtime behavior.

- [X] T001 Update OpenAI environment examples in `.env.example`
- [X] T002 [P] Add shared streaming status and response contract types in `src/shared/project-types.ts`
- [X] T003 [P] Create AI streaming test fixtures in `tests/ai/openai-streaming.fixtures.ts`
- [X] T004 [P] Create server message flow test fixtures in `tests/server/project-message-streaming.fixtures.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database, AI provider setup, and repository capabilities that block all user stories.

**CRITICAL**: No user story work can begin until this phase is complete.

### Database

- [X] T005 Extend project processing fields in `src/db/schema/projects.schema.ts`
- [X] T006 Extend message lifecycle fields in `src/db/schema/project-messages.schema.ts`
- [X] T007 Add agent message chunks schema in `src/db/schema/agent-message-chunks.schema.ts`
- [X] T008 Export agent message chunks schema from `src/db/schema.ts`
- [X] T009 Generate Drizzle migration for project processing, message lifecycle, and agent chunks in `src/db/migrations/`
- [X] T010 Update project and message domain types for processing state, parent message linkage, provider metadata, and timestamps in `src/shared/project-types.ts`

### AI Provider Instance

- [X] T011 Add OpenAI-specific env loading with legacy `AI_*` fallback in `src/ai/env.ts`
- [X] T012 Implement OpenAI client initialization and configuration validation in `src/ai/chatgpt-provider.ts`
- [X] T013 Add streaming provider interfaces and event types in `src/ai/ai-provider.ts`
- [X] T014 [P] Add prompt history builder for latest prompt plus project message history in `src/ai/prompt-builder.ts`
- [X] T015 [P] Add provider configuration unit tests in `tests/ai/env.test.ts`
- [X] T016 [P] Add prompt history builder unit tests in `tests/ai/prompt-builder.test.ts`

### Repository Foundation

- [X] T017 Add project processing update methods to `ProjectRepository` in `src/shared/project-types.ts`
- [X] T018 Implement project processing update methods in `src/server/repositories/project-repository.ts`
- [X] T019 Add agent chunk persistence and message content/state update methods to `ProjectMessageRepository` in `src/shared/project-types.ts`
- [X] T020 Implement agent chunk persistence and message content/state update methods in `src/server/repositories/message-repository.ts`
- [X] T021 Wire repository and provider dependencies through `src/server/services/project-services.ts`

**Checkpoint**: Database, provider construction, prompt context, and repository methods are ready for story work.

---

## Phase 3: User Story 1 - Receive AI Response After Sending a Project Prompt (Priority: P1) MVP

**Goal**: A logged-in project owner can submit a prompt from dashboard or project detail, persist the user message, generate an OpenAI-backed agent response using project message history, and persist the final agent message.

**Independent Test**: Log in as a project owner, submit a prompt from project detail, and verify the user message and completed agent response are visible after refresh. Submit from dashboard and verify redirect to project detail where the generated conversation belongs to the created project.

### Tests for User Story 1

- [X] T022 [P] [US1] Add message service tests for saving user message, creating agent message, and rejecting duplicate project processing in `tests/server/message-service.test.ts`
- [X] T023 [P] [US1] Add project creation tests for dashboard prompt persistence and immediate project detail redirect payload in `tests/server/project-service.test.ts`
- [X] T024 [P] [US1] Add OpenAI streaming completion mapping tests in `tests/ai/chatgpt-provider.test.ts`

### Implementation for User Story 1

#### Database

- [X] T025 [US1] Update message row mapping for new lifecycle fields and provider metadata in `src/server/repositories/message-repository.ts`
- [X] T026 [US1] Update project row mapping for idle/processing fields in `src/server/repositories/project-repository.ts`

#### AI Provider Instance

- [X] T027 [US1] Implement Responses API streaming text extraction in `src/ai/chatgpt-provider.ts`
- [X] T028 [US1] Map OpenAI response ids and provider events to app-level stream events in `src/ai/chatgpt-provider.ts`

#### Server Function

- [X] T029 [US1] Replace placeholder agent response with user message plus pending agent message creation in `src/server/services/message-service.ts`
- [X] T030 [US1] Update `createProjectFromPrompt` to save project and user message without placeholder agent content in `src/server/services/project-service.ts`
- [X] T031 [US1] Return `userMessage`, `agentMessage`, project processing state, and stream URL from `sendProjectMessage` in `src/server/functions/project-messages.ts`

#### Network

- [X] T032 [US1] Add authenticated SSE stream route for project agent messages in `src/routes/api/projects/$projectId/messages/$agentMessageId/stream.ts`
- [X] T033 [US1] Add shared SSE event serialization helpers in `src/server/functions/project-message-stream.ts`

#### Client UI

- [X] T034 [US1] Update project detail message state handling for send response shape in `src/routes/projects/$projectId.tsx`
- [X] T035 [US1] Render pending agent message placeholders in `src/components/projects/MessageBubble.tsx`
- [X] T036 [US1] Show project processing indicator in `ChatHeader` within `src/routes/projects/$projectId.tsx`

#### Client UI and Action Flows with Server

- [X] T037 [US1] Start streaming on project detail after `sendProjectMessage` succeeds in `src/routes/projects/$projectId.tsx`
- [X] T038 [US1] Start or resume dashboard-created agent streaming after immediate redirect in `src/routes/projects/$projectId.tsx`
- [X] T039 [US1] Ensure dashboard submit navigates immediately after project and user message persistence in `src/routes/dashboard/index.tsx`

**Checkpoint**: US1 works independently with persisted user message, OpenAI-backed agent response, dashboard redirect, and refresh-safe completed agent content.

---

## Phase 4: User Story 2 - See Response Text Progressively While It Is Generated (Priority: P2)

**Goal**: The project detail UI shows agent response text progressively while the server streams and persists accepted chunks.

**Independent Test**: Submit a prompt that produces multiple text segments and verify the agent message updates incrementally before completion, with project processing state visible until terminal state.

### Tests for User Story 2

- [ ] T040 [P] [US2] Add stream route tests for `message.started`, `message.delta`, and `message.completed` events in `tests/server/project-message-stream.test.ts`
- [ ] T041 [P] [US2] Add chunk persistence tests for ordered delta rollup in `tests/server/message-repository.test.ts`
- [ ] T042 [P] [US2] Add message panel rendering tests for streaming content and stable layout labels in `tests/components/ProjectMessagesPanel.test.tsx`

### Implementation for User Story 2

#### Database

- [X] T043 [US2] Persist each accepted stream delta as an ordered chunk in `src/server/repositories/message-repository.ts`
- [X] T044 [US2] Roll up chunk content into agent message content during streaming in `src/server/repositories/message-repository.ts`

#### AI Provider Instance

- [X] T045 [US2] Emit incremental text deltas from OpenAI `response.output_text.delta` events in `src/ai/chatgpt-provider.ts`

#### Server Function

- [X] T046 [US2] Add stream orchestration for started, delta, completed, and failed transitions in `src/server/services/message-service.ts`
- [X] T047 [US2] Preserve partial content and mark failed when provider streaming fails in `src/server/services/message-service.ts`

#### Network

- [X] T048 [US2] Send heartbeat and terminal SSE events from `src/routes/api/projects/$projectId/messages/$agentMessageId/stream.ts`
- [X] T049 [US2] Normalize stream error events to the contract format in `src/server/functions/project-message-stream.ts`

#### Client UI

- [X] T050 [US2] Append stream deltas to the matching agent message without replacing prior text in `src/routes/projects/$projectId.tsx`
- [X] T051 [US2] Add streaming visual state with semantic icon tokens in `src/components/projects/MessageBubble.tsx`
- [X] T052 [US2] Disable composer while project processing is active in `src/components/projects/MessageComposer.tsx`
- [X] T053 [US2] Keep message viewport scroll behavior stable for streaming appends in `src/components/projects/ProjectMessagesPanel.tsx`

#### Client UI and Action Flows with Server

- [X] T054 [US2] Handle stream completion by updating agent message state and project processing state in `src/routes/projects/$projectId.tsx`
- [X] T055 [US2] Handle stream failure by preserving partial text and showing failed state in `src/routes/projects/$projectId.tsx`

**Checkpoint**: US2 works independently with progressive stream rendering, chunk persistence, failure preservation, and smooth token-compliant UI states.

---

## Phase 5: User Story 3 - Stop an In-Progress Generation (Priority: P3)

**Goal**: A project owner can stop an active generation, preserve any partial response, and return project processing state to idle.

**Independent Test**: Submit a prompt, stop before completion, verify no more text is appended, refresh the page, and confirm the partial agent message remains marked stopped.

### Tests for User Story 3

- [X] T056 [P] [US3] Add stop generation service tests for partial and empty stopped messages in `tests/server/message-service.test.ts`
- [ ] T057 [P] [US3] Add stop generation contract tests in `tests/server/project-message-stop.test.ts`
- [ ] T058 [P] [US3] Add stop button rendering and interaction tests in `tests/components/MessageComposer.test.tsx`

### Implementation for User Story 3

#### Database

- [X] T059 [US3] Add stopped terminal state updates with partial content preservation in `src/server/repositories/message-repository.ts`

#### AI Provider Instance

- [X] T060 [US3] Support abort signals for active OpenAI streams in `src/ai/chatgpt-provider.ts`

#### Server Function

- [X] T061 [US3] Implement `stopProjectGeneration` service behavior in `src/server/services/message-service.ts`
- [X] T062 [US3] Export `stopProjectGeneration` server function in `src/server/functions/project-messages.ts`

#### Network

- [X] T063 [US3] Add stop request handling and active stream abort coordination in `src/server/functions/project-message-stream.ts`
- [X] T064 [US3] Emit `message.stopped` SSE event and close stream in `src/routes/api/projects/$projectId/messages/$agentMessageId/stream.ts`

#### Client UI

- [X] T065 [US3] Add stop generating control using semantic icon tokens in `src/components/projects/MessageComposer.tsx`
- [X] T066 [US3] Render stopped agent message state in `src/components/projects/MessageBubble.tsx`

#### Client UI and Action Flows with Server

- [X] T067 [US3] Wire stop action from project detail UI to `stopProjectGeneration` in `src/routes/projects/$projectId.tsx`
- [X] T068 [US3] Stop appending deltas after stop acknowledgement in `src/routes/projects/$projectId.tsx`

**Checkpoint**: US3 works independently with stop control, server abort behavior, partial persistence, stopped UI state, and idle project processing state.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, accessibility, consistency, and verification across all stories.

- [X] T069 [P] Update AI environment documentation in `README.md`
- [ ] T070 [P] Update quickstart findings if implementation changes any command or endpoint in `specs/004-openai-streaming-response/quickstart.md`
- [X] T071 Audit all new visible UI strings for English-only wording in `src/routes/projects/$projectId.tsx`
- [ ] T072 Audit message UI colors and icons for `DESIGN.md` semantic token compliance in `src/components/projects/MessageBubble.tsx`
- [X] T078 Remove sample project creation data and obsolete prefixed modules from `src/server/services/project-service.ts`
- [X] T079 Rename active prefixed shared/service/repository files and symbols to project-oriented names in `src/shared/project-types.ts`
- [X] T080 Add projects table rename migration in `src/db/migrations/0004_rename_projects_table.sql`
- [X] T073 Run code-review graph impact analysis for changed route, service, repository, schema, and AI provider files
- [X] T074 Run `pnpm typecheck`
- [X] T075 Run `pnpm lint`
- [X] T076 Run `pnpm test`
- [X] T077 Run `pnpm build`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1 and blocks all user stories.
- **Phase 3 US1**: Depends on Phase 2 and is the MVP.
- **Phase 4 US2**: Depends on Phase 2, but practically builds on US1 stream setup.
- **Phase 5 US3**: Depends on Phase 2, but practically builds on US1/US2 active stream lifecycle.
- **Phase 6 Polish**: Depends on completed selected user stories.

### User Story Dependencies

- **US1 (P1)**: First deliverable. Required for real prompt-to-agent response.
- **US2 (P2)**: Adds progressive UI and chunk persistence to the US1 response flow.
- **US3 (P3)**: Adds stop control to the active stream lifecycle.

### Parallel Opportunities

- T002, T003, and T004 can run in parallel after T001 is understood.
- T014, T015, and T016 can run in parallel with repository foundation work after shared types are drafted.
- US1 tests T022, T023, and T024 can run in parallel.
- US2 tests T040, T041, and T042 can run in parallel.
- US3 tests T056, T057, and T058 can run in parallel.
- Client UI token audit T072 and docs updates T069/T070 can run in parallel after implementation stabilizes.

---

## Parallel Example: User Story 1

```bash
Task: "T022 [US1] Add message service tests for saving user message, creating agent message, and rejecting duplicate project processing in tests/server/message-service.test.ts"
Task: "T023 [US1] Add project creation tests for dashboard prompt persistence and immediate project detail redirect payload in tests/server/project-service.test.ts"
Task: "T024 [US1] Add OpenAI streaming completion mapping tests in tests/ai/chatgpt-provider.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T040 [US2] Add stream route tests for message.started, message.delta, and message.completed events in tests/server/project-message-stream.test.ts"
Task: "T041 [US2] Add chunk persistence tests for ordered delta rollup in tests/server/message-repository.test.ts"
Task: "T042 [US2] Add message panel rendering tests for streaming content and stable layout labels in tests/components/ProjectMessagesPanel.test.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T056 [US3] Add stop generation service tests for partial and empty stopped messages in tests/server/message-service.test.ts"
Task: "T057 [US3] Add stop generation contract tests in tests/server/project-message-stop.test.ts"
Task: "T058 [US3] Add stop button rendering and interaction tests in tests/components/MessageComposer.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 foundational database, provider, and repository work.
3. Complete Phase 3 US1.
4. Validate project-detail prompt and dashboard redirect flows.
5. Stop and demo before adding progressive chunk UI and stop generation.

### Incremental Delivery

1. Add US1 for persisted OpenAI agent responses.
2. Add US2 for progressive streaming, chunk persistence, and failure preservation.
3. Add US3 for stop generation.
4. Run Phase 6 verification after each selected increment.

### Notes

- Keep code flow explicit: UI client -> server function/network -> service -> repository -> database.
- Do not add queues, image handling, token accounting, or project template generation.
- All visible UI text must be English.
- Use `DESIGN.md` and semantic app tokens for all new UI colors and icons.
