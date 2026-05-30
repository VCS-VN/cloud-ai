---
description: "Task list for Multi-Message Agent Runs With Skeleton & Milestone Messages"
---

# Tasks: Multi-Message Agent Runs With Skeleton & Milestone Messages

**Input**: Design documents from `/specs/021-multi-message-agent-runs/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-endpoints.md, contracts/sse-events.md, quickstart.md

**Tests**: INCLUDED — strategy "phase b" (rewrite from scratch). Mỗi phase tạo tests cùng hoặc trước code. Không update tests cũ (protocol cũ deprecated). KHÔNG test migration script.

**Organization**: Tasks theo **5 technical phases tuần tự** (không phải user-story slices) vì đây là full-stack refactor — cả 4 user story (US1 live progress, US2 stop/retry, US3 resume, US4 visual per kind) đều phụ thuộc chung schema + server + client, không deliver độc lập được. [US#] labels gắn vào task để traceability ngược về spec.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Chạy song song được (file khác nhau, không phụ thuộc task chưa xong)
- **[US#]**: User story mà task phục vụ (traceability)
- Mỗi task có file path cụ thể

## Path Conventions

Single-repo web app: `src/` ở repo root. Tests song song source trong `__tests__/`.

---

## Phase 1: Schema & Types (Foundation)

**Purpose**: Đổi schema DB + types nền tảng. BLOCKS tất cả phase sau.

**⚠️ CRITICAL**: Không phase nào bắt đầu trước khi P1 gate pass (drizzle push + tsc).

> **⚠️ Blast radius discovered (2026-05-30)**: `agent_runs.messageId` KHÔNG phải cột chết — orchestrator (`agent-orchestrator.server.ts:115`) tự `runStore.create({ messageId, status:"running" })` mỗi prompt. `AgentRunStatus` thực tế = `queued|running|waiting_for_clarification|completed|failed|cancelled`. Run ownership chuyển sang **MessageService** (tạo run ở POST `/runs`, orchestrator nhận `runId` thay vì tự create). Enum đổi shape mới: `streaming|completed|failed|stopped` (map: running→streaming, waiting_for_clarification→completed+clarification milestone, cancelled→stopped, bỏ queued). Tasks T001b, T010b, T023b, T024 phản ánh refactor này.

- [X] T001 [P] Modify `src/db/schema/agent-runs.schema.ts`: drop cột `message_id` + drop index `agent_runs_message_idx`; add `retry_of_run_id text NULL` + index `agent_runs_retry_idx`; add `reasoning_effort text NULL`; add `plan_mode boolean NOT NULL DEFAULT false`
- [X] T002 Modify `src/db/schema/agent-runs.schema.ts` (Constitution IX): chuyển tất cả cột JSON từ `jsonb()` → `json()` (intent, plan, affected_files, model_usage, thinking, validation_result, code_tool_run_state, error). Sequential sau T001 (cùng file)
- [X] T003 [P] Modify `src/db/schema/project-messages.schema.ts`: add `run_id text NULL`; add `kind text NULL`; add index `project_messages_project_run_idx` on `(project_id, run_id)`
- [X] T004 [P] Modify `src/db/schema/projects.schema.ts`: drop `active_agent_message_id`; add `active_run_id text NULL`
- [X] T005 Delete `src/db/schema/agent-message-chunks.schema.ts` + remove export trong `src/db/schema/index.ts`
- [X] T006 [P] [US1] [US2] Update `src/shared/project-types.ts`: add `Message.runId?` + `Message.kind?`; rename `Project.activeAgentMessageId` → `Project.activeRunId`; add `AgentMessageKind` enum (plan|answer|clarification|error|review_required); add `SkeletonPhase` enum (9 values incl client-only `starting`); add `SkeletonState`, `RunUIState`; replace `MessageStreamEvent` với `RunStreamEvent` + `RuntimeStreamEvent`; extend `StreamErrorCode` (+RUN_NOT_FOUND, +RUN_INTERRUPTED, +RETRY_NOT_ALLOWED); update `ProjectMessageRepository` interface (remove chunk methods, add `listMessagesByRunId`, allow updateMessage runId/kind); update `ProjectRepository.updateProjectProcessingState` signature (activeRunId)
- [X] T007 [P] Update `AgentRun` type trong `src/features/ai-agent/project/project-state.schema.ts`: drop `messageId`; add `retryOfRunId?`, `reasoningEffort?`, `planMode`; đổi `AgentRunStatus` từ `queued|running|waiting_for_clarification|completed|failed|cancelled` → `streaming|completed|failed|stopped`
- [X] T008 Run `pnpm db:generate` tạo migration file trong `src/db/migrations/` (sau T001-T005)
- [X] T009 **P1 GATE (adjusted)**: `pnpm db:generate` thành công + schema files + `project-types.ts`/`AgentRun` type đúng shape mới. **Full `tsc --noEmit` xanh KHÔNG đạt được tại P1** (whole-program check — consumer ở P2/P4 còn vỡ). Mốc tsc xanh: sau P2 (server closure) + sau P4 (client closure).

**Checkpoint**: Schema + types sẵn sàng. Server/client có thể build trên nền này.

---

## Phase 2: Server Core

**Purpose**: Repositories, MessageService run-based, event mapping, stream fan-out, endpoints. BLOCKS client phases.

**⚠️ DECISION cần chốt khi làm T023/T021**: Kick-off agent loop khi POST `/runs` hay khi client connect stream. Research recommends **connect-time** để buffer events từ đầu run (subscriber join giữa chừng nhận đủ). Xác nhận lúc implement.

### Repository layer

- [X] T010 [P] [US2] Refactor `src/server/repositories/agent-run-repository.ts`: bỏ `messageId` trong toRun/toValues; add `retryOfRunId`/`reasoningEffort`/`planMode`; add method `getActiveRun(projectId, userId?)`; add `listByRetryChain(runId)`
- [X] T010b [US1] [US2] Refactor `src/features/ai-agent/project/project-run-store.server.ts`: bỏ `messageId` khỏi `CreateAgentRunInput`; add `load(runId, userId?)` (cho orchestrator nhận run có sẵn); đổi status values theo enum mới (running→streaming); `waitForClarification`/`waitForHumanReview` → set `status:"completed"` (clarification/review giờ là message kind, không phải run status); `fail`→`status:"failed"`. Cập nhật `src/server/services/project-run-service.ts` mapping (bỏ messageId field). Depends T007
- [X] T011 [P] [US1] Modify `src/server/repositories/message-repository.ts`: add `listMessagesByRunId(runId, userId?)`; drop `saveAgentMessageChunk`/`listAgentMessageChunks`; allow `updateMessage` set `runId`/`kind`
- [X] T012 [P] [US3] Modify `src/server/repositories/project-repository.ts`: rename `activeAgentMessageId` → `activeRunId` trong updateProjectProcessingState + mapping
- [ ] T013 [P] [US2] Rewrite `src/server/repositories/__tests__/agent-run-repository.test.ts`: retryOfRunId chain, getActiveRun, options persist
- [ ] T014 [P] [US1] Update `src/server/repositories/__tests__/message-repository.test.ts`: listMessagesByRunId, kind/runId queries, no chunk methods
- [ ] T015 [P] [US3] Update `src/server/repositories/__tests__/project-repository.test.ts`: activeRunId set/clear

### Event mapping (presenter refactor)

- [X] T016 [P] [US1] Create `src/features/ai-agent/agent/agent-event-to-skeleton.ts`: map AgentStreamEvent → SkeletonUpdate cho 8 server phases (mapping table trong research.md Decision 11); throttle 200ms cùng phase, emit ngay khi phase đổi; sanitize detail qua `sanitizeForUser`
- [X] T017 [P] [US1] Create `src/features/ai-agent/agent/agent-event-to-milestone.ts`: quyết định milestone insert — plan chỉ khi `change_plan` có ≥1 file op (skip update_state_only/explain_only), format summary + file list truncate 10; answer lazy khi `assistant_message_delta` đầu; clarification/error/review_required triggers
- [X] T018 [US1] Modify `src/features/ai-agent/agent/user-facing-presenter.ts`: giữ `sanitizeForUser` + `TECHNICAL_PATTERNS` + `mapErrorCodeToFriendly`; xóa `formatUserFacingStatus` + `deriveContextFromEvents` (không còn dùng)
- [X] T019 [P] [US1] Create `src/features/ai-agent/agent/__tests__/agent-event-to-skeleton.test.ts`: 8 phase mapping + throttle behavior
- [X] T020 [P] [US1] Create `src/features/ai-agent/agent/__tests__/agent-event-to-milestone.test.ts`: plan skip conditions, answer lazy, terminal kinds

### Stream infrastructure

- [X] T021 [US3] Refactor `src/server/functions/project-message-stream.ts` → run channel multi-subscriber fan-out (`Map<runKey, Set<EnqueueFn>>` + event buffer per run); stale resume cleanup (runId không trong memory + DB processing → mark messages failed, project idle, emit `run.failed` code RUN_INTERRUPTED); heartbeat 15s; serialize qua `redactJson`
- [X] T022 [P] [US3] Create `src/server/services/runtime-service.ts`: project-level dev runtime broadcast (`Map<projectId, Set<EnqueueFn>>` + latest snapshot); heartbeat 15s
- [X] T023 [US1] [US2] Refactor `src/server/services/message-service.ts`: `createRun` (insert user msg + agent run qua runStore với status streaming + project processing + active_run_id, KHÔNG chạy orchestrator), `streamRun` (connect-time: gọi `orchestrator.handlePromptStream({ runId })`, map events qua T016/T017, write-through milestones, fan-out emit), `stopRun` (idempotent abort + run stopped + answer partial), `retryRun` (new run retryOfRunId, no new user msg, copy options). Depends T010, T010b, T011, T012, T016-T018, T021

### Orchestrator + prompts

- [X] T024 [US1] Modify `src/features/ai-agent/agent/agent-orchestrator.server.ts`: `handlePromptStream` nhận `runId` bắt buộc (input), gọi `runStore.load(runId)` thay vì `runStore.create()` (run đã được MessageService tạo ở POST); emit run-based stream events (qua mapping helpers) thay vì text delta append; bỏ `messageId` param (dùng runId). Depends T010b
- [X] T025 [P] [US1] Modify `src/features/ai-agent/agent/agentic-prompts.server.ts`: instruct LLM không liệt kê file paths trong answer text (vì plan milestone đã hiển thị thay đổi)

### Server functions + API routes

- [X] T026 [P] [US1] Create `src/server/functions/project-runs.ts`: server functions cho createRun/streamRun/stopRun/retryRun (wrap MessageService)
- [X] T027 [P] [US3] Create `src/server/functions/project-runtime.ts`: server function cho runtime channel (wrap runtime-service)
- [X] T028 [P] [US1] Create route `src/routes/api/projects/$projectId/runs/index.ts`: POST tạo run → `{ runId, userMessage, streamUrl }`
- [X] T029 [US1] Create route `src/routes/api/projects/$projectId/runs/$runId/stream.ts`: GET SSE run channel (replay buffer + live + stale cleanup)
- [X] T030 [P] [US2] Create route `src/routes/api/projects/$projectId/runs/$runId/stop.ts`: POST stop idempotent
- [X] T031 [P] [US2] Create route `src/routes/api/projects/$projectId/runs/$runId/retry.ts`: POST retry (RETRY_NOT_ALLOWED nếu không phải failed)
- [X] T032 [P] [US3] Create route `src/routes/api/projects/$projectId/runtime/stream.ts`: GET SSE runtime channel
- [X] T033 [US1] Delete routes `src/routes/api/projects/$projectId/messages/$agentMessageId/stream.ts` + `.../stop.ts`; giữ messages list route; update `src/server/functions/projects.ts` đổi activeAgentMessageId field references
  - **Discrepancy phát hiện (P2)**: `ProjectService.createProjectFromPrompt` (entry point thứ 3 kích hoạt agent — dùng ở dashboard + landing, không qua MessageService) cũng pre-create agent placeholder message + set `activeAgentMessageId`. Đã migrate sang run model: inject `runStore` vào ProjectService, thay agent placeholder bằng `runStore.create` + `activeRunId`, return chỉ `[userMessage]` (answer tạo lazy khi stream).

### Server tests + gate

- [X] T034 [P] [US1] Create `src/server/services/__tests__/message-service.run-lifecycle.test.ts`: full run (plan + answer), text-only run, fail-before-delta (error only), write-through ordering — mock orchestrator
- [X] T035 [P] [US2] Create `src/server/services/__tests__/message-service.stop-retry.test.ts`: stop idempotent + partial answer, retry new run + retryOfRunId + no new user msg
- [X] T036 [P] [US3] Create `src/server/services/__tests__/message-service.resume-cleanup.test.ts`: stale run → RUN_INTERRUPTED, multi-subscriber fan-out (2 subscribers nhận đủ events)
- [X] T037 [P] [US3] Create `src/server/services/__tests__/runtime-service.test.ts`: snapshot on connect + broadcast multi-subscriber
- [X] T038 **P2 GATE**: server-side `pnpm tsc --noEmit` xanh cho server closure (db/server/features/ai-agent/agent — client `$projectId.tsx` có thể còn vỡ tới P4); server unit + integration tests pass; curl smoke (POST /runs → stream events → stop idempotent 200×2)

**Checkpoint**: Server protocol hoạt động end-to-end (verify qua curl). Client có contract ổn định để build.

---

## Phase 3: Client Protocol

**Purpose**: Reducer + stream hook khớp protocol mới. BLOCKS client UI.

- [X] T039 [US1] Rewrite `src/features/ai-agent/ui/agent-event-reducer.ts`: state shape `ChatUIState { messages, activeRun, runtime }` + `RunUIState`; handle run.started/message.created/message.delta/message.completed/skeleton.update/run.completed|failed|stopped/heartbeat; `run.completed` → activeRun=null ngay
- [X] T040 [US3] Rewrite `src/features/ai-agent/ui/use-agent-stream.ts`: mở 2 EventSource (run + runtime); optimistic skeleton (temp_ prefix userMessage + phase `starting`); SSE timeout 30s + 1 retry reconnect; reload đọc `activeRunId` → reconnect run channel; rollback optimistic khi POST fail
- [X] T041 [P] [US1] Create `src/features/ai-agent/ui/__tests__/agent-event-reducer.test.ts`: mọi event transition, activeRun=null on terminal
- [X] T042 [P] [US3] Create `src/features/ai-agent/ui/__tests__/use-agent-stream.test.ts`: optimistic flow, timeout+retry, runtime channel tách
- [X] T043 **P3 GATE**: client unit tests pass (reducer transitions, optimistic, timeout)

**Checkpoint**: Client state machine ổn định. UI components có state shape để render.

---

## Phase 4: Client UI

**Purpose**: Render per-kind, skeleton bubble, visual grouping, composer. Hoàn thiện UX nhìn thấy được.

- [X] T044 [P] [US4] Create `src/components/projects/PlanMessageContent.tsx`: render summary line đầu, ẩn file list (v1); data đã sẵn trong content cho future flip
- [X] T045 [P] [US1] Create `src/components/projects/SkeletonMessageBubble.tsx`: Loader2 + label/detail từ skeleton state; background subtle, KHÔNG dashed border; dùng `--app-icon-muted` token (Constitution V)
- [X] T046 [US4] Modify `src/components/projects/MessageBubble.tsx`: per-kind switch — answer dùng dumprify; plan dùng `PlanMessageContent`; clarification badge ❓; error badge ❌; review_required badge ⚠ (depends T044)
- [X] T047 [US4] Modify `src/components/projects/ProjectMessagesPanel.tsx`: wrapper `<div data-run-group border-l border-[var(--app-border-soft)] pl-sm>` quanh agent messages cùng runId; user msg + skeleton KHÔNG trong wrapper; run 1 message vẫn render wrapper
- [X] T048 [US2] Modify `src/routes/projects/$projectId.tsx`: composer send/stop toggle (processing → stop button); optimistic insert + rollback (restore text + toast error); wire 2 SSE channels qua use-agent-stream; stop fire-and-forget + "Stopping..." label; composer cho gõ tự do, text persist qua run lifecycle
- [X] T049 [US1] Delete `src/features/ai-agent/ui/agent-event-timeline.tsx` + xóa mọi import (ProjectMessagesPanel, $projectId.tsx). **Cũng xóa `src/features/ai-agent/ui/agent-progress.ts`** (consumer của `formatUserFacingStatus` đã xóa ở T018 — synthesize text content vô nghĩa trong model milestone mới) + cập nhật `$projectId.tsx` bỏ `synthesizeAgentProgressContent`/`shouldReplaceStaleAgentContent` (discrepancy phát hiện ở P2)
- [ ] T050 [P] [US4] Create `src/components/projects/__tests__/MessageBubble.test.tsx`: render đúng per kind + badges
- [X] T051 [P] [US4] Create `src/components/projects/__tests__/PlanMessageContent.test.tsx`: chỉ summary, file list ẩn
- [ ] T052 [P] [US1] Create `src/components/projects/__tests__/SkeletonMessageBubble.test.tsx`: phase label render
- [X] T053 [P] [US4] Create `src/components/projects/__tests__/ProjectMessagesPanel.test.tsx`: grouping wrapper boundaries (user/skeleton excluded, 1-msg run wrapped)
- [X] T054 **P4 GATE**: full `pnpm tsc --noEmit` xanh (cả client closure đóng); component tests pass + manual golden path browser (gửi prompt → skeleton → milestones → reload đúng)

**Checkpoint**: Feature nhìn thấy được + tương tác được. Tất cả 4 user story functional.

---

## Phase 5: Polish & Cross-Cutting

**Purpose**: Edge cases, cleanup, perf. Cross-cutting toàn bộ stories.

- [ ] T055 [US2] [US3] Verify edge cases (manual + add tests nếu thiếu): stop mid-stream giữ partial, retry chain, reload mid-run resume đúng phase, multi-tab 2 subscriber, clarification reply tạo run mới, run fail trước delta → error only
- [ ] T056 Cleanup dead code: confirm `formatUserFacingStatus` đã xóa sạch references; không còn `agent_message_chunks` references; `AgentEventTimeline` xóa hoàn toàn; remove unused imports
- [ ] T057 Perf check: skeleton throttle 200ms cùng phase (network tab khi tool calls liên tiếp); SSE bandwidth ≤ +30% so baseline (đo payload size, no sequence field)
- [ ] T058 **P5 GATE**: `pnpm vitest run` full pass; `pnpm lint` pass (import alias `@/` — Constitution X); `pnpm build` pass

**Checkpoint**: Feature hoàn chỉnh, sạch, đạt success criteria.

---

## Dependencies & Execution Order

### Phase Dependencies (STRICT SEQUENTIAL)

```text
P1 (schema+types) ──blocks──> P2 (server) ──blocks──> P3 (client protocol) ──blocks──> P4 (client UI) ──blocks──> P5 (polish)
```

Mỗi phase phải pass GATE (T009/T038/T043/T054/T058) trước khi phase sau bắt đầu.

### Critical path within phases

- **P1**: T001→T002 (cùng file agent-runs.schema). T003/T004/T006/T007 [P]. T005 độc lập. T008 sau T001-T005. T009 gate cuối.
- **P2**: Repos T010-T012 [P] → tests T013-T015 [P]. Event mapping T016/T017 [P], T018 sau (presenter). T021 (stream) + T022 (runtime) [P]. **T023 (MessageService) phụ thuộc T010-T012 + T016-T018 + T021**. T024 sau T023. Server fns T026/T027 [P] sau T023. Routes T028-T032 sau server fns. T033 (delete + projects.ts) sau routes. Tests T034-T037 [P] sau T023. T038 gate.
- **P3**: T039 (reducer) → T040 (hook, dùng reducer). Tests T041/T042 [P]. T043 gate.
- **P4**: T044/T045 [P] → **T046 (MessageBubble) phụ thuộc T044**. T047 (panel) sau T046. T048 (route) sau T040+T047. T049 (delete timeline) sau T047/T048. Component tests T050-T053 [P]. T054 gate.
- **P5**: T055-T057 sau P4. T058 gate cuối.

### User story traceability

- **US1 (live progress + milestones)**: T006, T011, T016-T020, T023-T026, T028-T029, T034, T039, T045, T049, T052
- **US2 (stop + retry)**: T006, T010, T013, T023, T030-T031, T035, T048, T055
- **US3 (resume / multi-tab)**: T012, T015, T021-T022, T027, T032, T036-T037, T040, T042, T055
- **US4 (visual per kind)**: T044, T046-T047, T050-T051, T053

### Parallel opportunities

- **P1**: T001, T003, T004, T006, T007 song song (file khác). T002 sau T001.
- **P2 repos**: T010, T011, T012 song song. Tests T013-T015 song song.
- **P2 mapping**: T016, T017 song song. T019, T020 song song.
- **P2 routes**: T028, T030, T031, T032 song song (T029 dính stream logic nặng hơn).
- **P2 service tests**: T034-T037 song song.
- **P4 new components**: T044, T045 song song. Component tests T050-T053 song song.

---

## Parallel Example: Phase 2 Repository Layer

```bash
# Sau khi P1 gate pass, launch 3 repos song song:
Task: "Refactor agent-run-repository.ts (T010)"
Task: "Modify message-repository.ts (T011)"
Task: "Modify project-repository.ts (T012)"

# Rồi launch tests song song:
Task: "agent-run-repository.test.ts (T013)"
Task: "message-repository.test.ts (T014)"
Task: "project-repository.test.ts (T015)"
```

## Parallel Example: Phase 2 Event Mapping

```bash
# Song song với repos (file độc lập):
Task: "agent-event-to-skeleton.ts (T016)"
Task: "agent-event-to-milestone.ts (T017)"
Task: "agent-event-to-skeleton.test.ts (T019)"
Task: "agent-event-to-milestone.test.ts (T020)"
```

---

## Implementation Strategy

### Sequential phases (bắt buộc cho refactor này)

Khác với feature mới (slice theo user story), refactor full-stack này phải đi tuần tự P1→P5 vì mọi story chia sẻ cùng nền schema/server/client. Không có "MVP 1 story" — feature chỉ chạy khi cả stack đổi xong.

### Per-phase delivery

1. **P1**: Schema + types. Verify build pass. Commit.
2. **P2**: Server core. Verify qua curl + tests. Commit. (Đây là milestone lớn nhất — protocol hoạt động.)
3. **P3**: Client protocol. Verify reducer tests. Commit.
4. **P4**: Client UI. Verify browser golden path. Commit. (Feature nhìn thấy được.)
5. **P5**: Polish. Verify full suite + lint + build. Commit.

### Recommended checkpoint demos

- Sau P2: demo qua curl rằng run tạo milestones + skeleton events đúng.
- Sau P4: demo browser full UX (skeleton → milestones → stop → retry → reload).

---

## Notes

- [P] = file khác nhau, không phụ thuộc task chưa xong.
- [US#] = traceability ngược spec.md (không phải phase boundary — phase ở đây là technical).
- Tests rewrite from scratch (phase b) — không update tests cũ.
- Pre-prod: migration drop & recreate OK, không backfill, không test migration script.
- Constitution: IX (jsonb→json T002 minh bạch), X (alias @/ — T058 lint gate), VIII (ESLint T058), V (design tokens T045/T047).
- Commit sau mỗi phase gate (hoặc logical group trong phase).
- **Decision chốt khi làm T021/T023**: kick-off agent loop tại connect-time (research recommended) để buffer events từ đầu run.
