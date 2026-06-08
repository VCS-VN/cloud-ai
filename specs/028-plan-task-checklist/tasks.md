---
description: "Task list for plan task checklist feature"
---

# Tasks: Plan Task Checklist

**Input**: Design documents from `/specs/028-plan-task-checklist/`
**Prerequisites**: spec.md, plan.md, data-model.md

**Tests**: Vitest unit + integration suites are REQUIRED (Constitution Principle II + grill decision Câu 13 B). Test tasks are interleaved with implementation per phase.

**Organization**: Tasks are grouped by phase (matching plan.md). Each phase ends in a verifiable state (typecheck + unit tests pass). User-visible behavior is reachable from the end of Phase 6 onward; Phases 7-9 finalize replay, cleanup, integration.

## Format: `[ID] [P?] [Phase] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- File paths are repo-rooted

---

## Phase 1: Foundational schemas & types

**Purpose**: Add discriminated-union variants and type extensions that downstream phases depend on. Pure type changes — no runtime behavior.

- [x] T001 [P1] Extend `AgentRunProgressTimelineEvent` in `src/features/projects/legacy/project-state.schema.ts` with `task_plan` + `task_transition` variants per data-model.md §1.2.
- [x] T002 [P1] Add 5 new `BuilderRunEvent` variants in `src/features/agents/ui/builder-events.ts`: `plan.created`, `plan.task.started`, `plan.task.completed`, `plan.task.paused`, `plan.task.resumed` per data-model.md §3.1.
- [x] T003 [P1] Add 5 new `RunStreamEvent` variants in `src/shared/project-types.ts` matching the BuilderRunEvent additions. Extend `RunUIState` with `tasks: Array<{ id; title; phase }> | null` and `taskStatuses: Record<string, "pending" | "active" | "paused" | "done">` per data-model.md §6.2.
- [x] T004 [P1] Extend `BuilderRunHandle` in `src/features/agents/codex/runtime/builder-run-registry.server.ts` with `taskList` + `taskStatuses` fields per data-model.md §2.2. Initialize them in `createBuilderRunHandle` (taskList=null, taskStatuses={}).
- [x] T005 [P1] Run `pnpm typecheck` from repo root. Fix any type errors that surface from existing call sites that need updating to handle the widened unions (most should infer cleanly via discriminated-union narrowing).

**Checkpoint**: Typecheck clean. No runtime change yet — feature dormant.

---

## Phase 2: Server-side LLM modules

**Purpose**: Build the classifier and planner LLM modules behind a clean interface. Each module is a pure function with mockable codex thread input. Unit tests cover both.

- [x] T006 [P2] [P] Create `src/features/agents/codex/runtime/plan-classifier.server.ts` exporting `classifyPromptComplexity(input)` per data-model.md §4. Schema validation via Zod with EN fallback for invalid language; complex fallback for invalid complexity. Honors AbortSignal. Logs `plan_classifier_decision` with `{ runId, prompt_length, decision }` for observability.
- [x] T007 [P2] [P] Create `src/features/agents/codex/runtime/plan-generator.server.ts` exporting `generatePlan(input)` per data-model.md §5. Reuse `stripCodeFence` pattern from `design-variants.server.ts`. Validate with Zod schema (range 2-8, unique IDs, privacy filter via `isPrivacySafe`). 1 retry on validation failure. Returns `{ ok: true, tasks, rawResponse } | { ok: false, reason }`.
- [x] T008 [P2] [P] Create `tests/unit/plan-classifier.test.ts` with ~5 cases: parse simple, parse complex, parse language code, fallback EN on invalid language regex, fallback complex on invalid complexity, AbortError propagation immediate (no retry).
- [x] T009 [P2] [P] Create `tests/unit/plan-generator.test.ts` with ~6 cases: parse valid bare JSON, parse fenced JSON (```json), retry validation when first attempt invalid (range/privacy), reject 1-task list, reject 9-task list, reject task with file path in title.
- [x] T010 [P2] Run unit tests for the new modules: `pnpm vitest run tests/unit/plan-classifier.test.ts tests/unit/plan-generator.test.ts`. All cases pass.

**Checkpoint**: Both LLM modules unit-tested in isolation. Driver wiring not yet present.

---

## Phase 3: Helper orchestrator + driver wiring

**Purpose**: Compose classifier+planner into the helper, then call the helper from each driver after `loading_context` (and after variant pick for init). Add the milestone-bucket transition helpers.

- [x] T011 [P3] Create `src/features/agents/codex/runtime/plan-generation.server.ts` exporting `runPlanGenerationPhase(ctx, deps, emit, options)` per plan.md "Sequence" section. Init bypass logic. Lenient fallback on classifier/planner failure. After successful planner output: persists nothing directly (driver fires BuilderRunEvents; translator persists), publishes `plan.created`, sets `handle.taskList` + `handle.taskStatuses`, then calls `fireTaskTransitions` for the current bucket (G1 fix — tick prep tasks active immediately).
- [x] T012 [P3] Add helpers in `src/features/agents/codex/runtime/builder-run.server.ts` (or a new sibling file `task-transition.server.ts` if line count grows): `fireTaskTransitions(handle, emit, enteringMilestone)`, `fireTaskPauseAll(handle, emit)`, `fireTaskResumeAll(handle, emit)`, `fireRemainingTasksComplete(handle, emit)`. Each helper publishes the matching BuilderRunEvent and mutates `handle.taskStatuses`. The `MILESTONE_TO_BUCKET` map per data-model.md §7.
- [x] T013 [P3] Wire `runPlanGenerationPhase` into `runInitBuilderRun`: after the variant clarification resolves, before the existing `planning` milestone fire site. Pass `{ bypassClassifier: true, promptOverride: prompt + variant context, languageOverride: "en" }`. Skip when `ctx.planMode === true`.
- [x] T014 [P3] Wire `runPlanGenerationPhase` into `runUpdateBuilderRun`: after `loading_context` milestone, before `planning` milestone. Pass plain ctx.userPrompt. Skip when `ctx.planMode === true`.
- [x] T015 [P3] Wire `runPlanGenerationPhase` into `runNewRouteBuilderRun`: after `loading_context` milestone, before `planning` milestone. Pass plain ctx.userPrompt. Skip when `ctx.planMode === true`.
- [x] T016 [P3] Wire `fireTaskTransitions` calls at every existing milestone fire site in all three drivers (creating_draft, building_pages, checking_preview, publishing). Wire `fireTaskPauseAll` before each `awaiting_clarification` publish. Wire `fireTaskResumeAll` at the start of each `resumeFn` callback. Wire `fireRemainingTasksComplete` immediately before each `done` event emission (NOT for `failed`/`cancelled`).
- [x] T017 [P3] Run `pnpm typecheck`. Fix any errors.

**Checkpoint**: Drivers fire BuilderRunEvent task transitions in correct order. Translator does not yet pass them through (next phase).

---

## Phase 4: Bridge translator pass-through

**Purpose**: Translate driver-side BuilderRunEvent → SSE-side RunStreamEvent. Persist task_plan + task_transition to progressTimeline.

- [x] T018 [P4] In `src/server/services/builder-run-translator.server.ts`, add 5 new case clauses in `translateBuilderEventToRunStreamEvent` for the new event types. Each case is mostly pass-through with re-shape: `plan.created` returns `{ events: [{type:"plan.created", runId, tasks, at}], persist: null, timeline: { kind: "task_plan", tasks }, terminal: null }`; `plan.task.<transition>` returns analogous with `timeline: { kind: "task_transition", id, transition }`.
- [x] T019 [P4] Extend `ProgressTimelineDirective` union in `builder-run-translator.server.ts` with two new variants: `{ kind: "task_plan"; tasks: ... }` and `{ kind: "task_transition"; id; transition }`.
- [x] T020 [P4] Verify `runBuilderBridge` in `src/server/services/builder-run-bridge.server.ts` correctly persists timeline directives — check that `persist` calls `appendProgressTimelineEvent` with the new directive shapes. If a switch-case is in the bridge, extend it; otherwise the existing `persist` path may already pass through unchanged.
- [x] T021 [P4] Update `src/server/repositories/agent-run-repository.ts` if any type narrowing on `progressTimeline` events is required (e.g., parsing function). Most likely zero changes since `json()` column passes through unchanged.
- [x] T022 [P4] Create `tests/unit/plan-translator.test.ts` with ~5 cases: bucket-enter on `creating_draft` fires `task.started` for build tasks + `task.completed` for prep active tasks; no transitions for `repairing` milestone; `awaiting_clarification` triggers pause helper (test the helper directly, not the translator); `done` flushes remaining; init bucket=prep mapping correct.
- [x] T023 [P4] Run `pnpm typecheck` and `pnpm vitest run tests/unit/plan-translator.test.ts`. Pass.

**Checkpoint**: Server emits task events through the chat-event-channel. FE not yet listening.

---

## Phase 5: Frontend reducer + stream hook

**Purpose**: Extend the reducer to handle 5 new event types. Add 5 listeners in useChatStream.

- [x] T024 [P5] Extend `chatStateReducer` in `src/features/agents/ui/agent-event-reducer.ts` with 5 case clauses per data-model.md §6.3. `plan.created` initializes `tasks` + `taskStatuses` (all-pending). Each transition mutates `taskStatuses[event.taskId]`. Update `run.started` to initialize `tasks: null`, `taskStatuses: {}`.
- [x] T025 [P5] Extend `RunUIState` (in `src/shared/project-types.ts` if defined there, otherwise in `agent-event-reducer.ts` if locally defined) with `tasks` + `taskStatuses` fields per data-model.md §6.2. Update `createInitialChatState` if it constructs an initial RunUIState.
- [x] T026 [P5] Add 5 event-type strings to the listener loop in `src/features/agents/ui/use-chat-stream.ts` (lines 166-183). The existing `onAny` parser already dispatches `kind: "run"` actions to the reducer — no separate handler needed.
- [x] T027 [P5] [P] Create `tests/unit/chat-stream-reducer-tasks.test.ts` with ~5 cases: plan.created initializes statuses, started→active, completed→done, paused→paused, resumed→active, run.completed clears activeRun.
- [x] T028 [P5] Run `pnpm typecheck` and `pnpm vitest run tests/unit/chat-stream-reducer-tasks.test.ts`. Pass.

**Checkpoint**: FE receives and stores task events in `state.activeRun.tasks/taskStatuses`. Nothing renders yet.

---

## Phase 6: Frontend UI component

**Purpose**: Render the sticky checklist card with collapse, animation, full ARIA.

- [x] T029 [P6] Create `src/features/agents/ui/PlanChecklist.tsx` per plan.md "UI rendering" section + grill decisions G5 (collapse default expanded, click chevron toggle, header format `◐ N/total: title`) + G6 C (full ARIA roles, EN status text). Local `useState<boolean>(true)` for expanded.
- [x] T030 [P6] Update `src/features/agents/ui/index.ts` to export `PlanChecklist` (and remove the soon-to-delete `BuilderRunProgress` and `useBuilderRunStream` re-exports — see Phase 8).
- [x] T031 [P6] Mount `<PlanChecklist>` in `src/routes/projects/$projectId.tsx` between the messages list scroll container and the `<MessageComposer>`. Pass `tasks={state.activeRun?.tasks ?? null}`, `statuses={state.activeRun?.taskStatuses ?? {}}`, `runClosed={state.activeRun === null}`. Component returns `null` when `tasks` is `null` or empty (existing single-label behavior preserved).
- [x] T032 [P6] Run `pnpm typecheck` and `pnpm dev`. Visually verify on a complex prompt: checklist appears, expand/collapse works, status icons transition correctly, animation stops when run terminal.

**Checkpoint**: User-visible behavior live for complex runs. Simple runs and plan-mode runs unchanged.

---

## Phase 7: Archive replay

**Purpose**: Reload mid-run reproduces task statuses up to last persisted transition.

- [x] T033 [P7] Extend `RunForReplay.progressTimeline` union in `src/routes/api/projects/$projectId/builder-runs/$runId/stream.ts` with the two new variants.
- [x] T034 [P7] In `buildArchivedReplay`, add two new branches inside the timeline iterator: `task_plan` → enqueue `{ type: "plan.created", runId, tasks, at }`; `task_transition` → enqueue `{ type: "plan.task.<transition>", runId, taskId, at }`.
- [x] T035 [P7] Run integration test (next phase) covers archive replay equivalence; for this phase, run `pnpm typecheck` clean.

**Checkpoint**: Reload mid-run shows the correct checklist state. Reload after run completes shows all-completed checklist.

---

## Phase 8: Cleanup of dead code

**Purpose**: Delete `BuilderRunProgress.tsx` and `useBuilderRunStream.ts` per G4 decision.

- [x] T036 [P8] Verify zero callers: `rg "BuilderRunProgress|useBuilderRunStream|use-builder-run-stream" --type=ts --type=tsx src/`. Should return zero matches outside the to-be-deleted files themselves and the `index.ts` re-exports.
- [x] T037 [P8] Delete `src/features/agents/ui/BuilderRunProgress.tsx`.
- [x] T038 [P8] Delete `src/features/agents/ui/use-builder-run-stream.ts`.
- [x] T039 [P8] Update `src/features/agents/ui/index.ts` to remove the `export * from "./BuilderRunProgress"` and `export * from "./use-builder-run-stream"` lines.
- [x] T040 [P8] Run `pnpm typecheck` + `pnpm lint`. Build clean.

**Checkpoint**: Dead code removed. Build clean.

---

## Phase 9: Integration test + manual verification

**Purpose**: End-to-end test + quickstart manual checklist.

- [x] T041 [P9] Create `tests/integration/plan-checklist-end-to-end.test.ts` with 1 case: mock codex thread to return classifier=complex+language=en then planner JSON, run `runUpdateBuilderRun` with mocked deps, assert progressTimeline contains `task_plan` followed by ordered `task_transition` events, and the chat-event-channel emitted matching `plan.created` + 5 task transitions in order.
- [x] T042 [P9] Run full test suite: `pnpm vitest run`. All ≥ 13 new cases pass; no regressions in existing suites.
- [x] T043 [P9] Run `pnpm typecheck` + `pnpm lint`. Clean.
- [ ] T044 [P9] Execute `specs/028-plan-task-checklist/quickstart.md` manual checklist on local dev. Capture screenshots if requested by reviewer.

**Checkpoint**: Feature complete. Ready for PR.

---

## Dependencies

- Phase 1 → Phase 2/3/4/5 (types must exist first)
- Phase 2 → Phase 3 (helper composes classifier+planner)
- Phase 3 → Phase 4 (drivers must fire BuilderRunEvents before translator can pass them through)
- Phase 4 → Phase 5 (server must emit RunStreamEvents before reducer can consume)
- Phase 5 → Phase 6 (state must populate before component can render)
- Phase 6 → Phase 7 (live UI before archive replay verification meaningful)
- Phase 7 → Phase 8 (cleanup last to avoid masking bugs)
- Phase 8 → Phase 9 (integration test verifies post-cleanup state)

Within Phase 2: T006/T007/T008/T009 are `[P]` parallelizable.
Within Phase 5: T024/T025/T026/T027 are sequential except T027 which is `[P]` against T024.

---

## Estimate

- Phase 1: ~2 hours
- Phase 2: ~4 hours
- Phase 3: ~6 hours (driver wiring is the heaviest)
- Phase 4: ~3 hours
- Phase 5: ~2 hours
- Phase 6: ~3 hours
- Phase 7: ~1 hour
- Phase 8: ~30 min
- Phase 9: ~2 hours

Total: ~24 hours of focused work. Realistic schedule with reviews and edge-case fixes: 3-4 days.
