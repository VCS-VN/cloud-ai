# Implementation Plan: Plan Task Checklist

**Branch**: `028-plan-task-checklist` | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/028-plan-task-checklist/spec.md`

## Summary

Add a live task checklist UI to the chat panel so users can follow agent progress at task granularity instead of a single static label. When a user submits a complex prompt (and plan mode is OFF), an LLM classifier detects prompt language and complexity; if `complex`, an LLM planner generates 2-8 short tasks tagged with one of three coarse phase buckets (`prep`, `build`, `verify`). The driver fires task transitions on milestone bucket boundaries; the chat-event-channel translator passes them through; the chat reducer maintains task state inside `activeRun`; a sticky `<PlanChecklist>` component renders a collapsible list with full ARIA semantics. Lenient fallback throughout — plan failures degrade to the existing single-label UI, never failing the run. Plan mode (markdown approval) is preserved unchanged: when ON, no task list is generated.

## Technical Context

**Language/Version**: TypeScript 5.x with React 19, TanStack Router/Query/Start
**Primary Dependencies**: `@openai/codex-sdk` (^0.137.0), Drizzle ORM, PostgreSQL via `postgres-js`, Zod, Vitest, Tailwind CSS, shadcn/ui (radix). No new dependencies introduced.
**Storage**: PostgreSQL — extends existing `agent_runs.progress_timeline` JSON column with two new variants (`task_plan`, `task_transition`). No new column. No SQL migration required (per Constitution IX, JSON column already in place).
**Testing**: Vitest unit (4 suites: classifier, planner, translator, reducer) + 1 integration end-to-end. ~13 test cases total.
**Target Platform**: Self-hosted Node.js 22+ runtime. Browser clients on modern evergreen browsers.
**Project Type**: Single-repo web application — TanStack Router routes serve UI and `/api/...` endpoints together.
**Performance Goals**: First checklist visible within 10s of prompt submit (SC-001); simple-prompt latency unchanged within 1.25× tolerance (SC-002); SSE event lag ≤ 200ms within local network.
**Constraints**: Zero leakage of file paths/code/framework names in task titles (FR-003, SC-003); plan failures must NOT fail the run (FR-009); cancel must propagate AbortSignal immediately (FR-010); plan mode unchanged (FR-011); publish-first ordering accepted with documented trade-off (FR-006).
**Scale/Scope**: ≤ 200 events per run via existing `MAX_PROGRESS_TIMELINE_EVENTS` cap. One in-flight builder run per project at a time (existing invariant).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance |
|-----------|------------|
| I. Yêu cầu rõ ràng code flow & tính năng | PASS — every change is documented end-to-end (spec, data-model, plan, tasks). Driver flow: `loading_context → variant pick (init only) → runPlanGenerationPhase → planning → execute`. Translator flow: `BuilderRunEvent (driver) → RunStreamEvent (translator) → chatStateReducer (FE)`. |
| II. Test cho mọi business rule quan trọng | PASS — 4 unit suites + 1 integration suite cover classifier parsing/fallback, planner schema/privacy, translator bucket transitions, reducer state, end-to-end driver wiring. |
| III. API trả lỗi nhất quán | PASS — no new HTTP endpoints. New SSE event types follow existing `RunStreamEvent` discriminated union shape. |
| IV. Không over-engineer | PASS — reuses existing infrastructure: `progressTimeline` JSON column, `BoundedCodexThread` retry logic, chat-event-channel, `chatStateReducer`. No new framework, no outbox pattern, no new persistence. Lenient fallback ensures the feature is purely additive — failures degrade gracefully. |
| V. UX & DESIGN.md compliance | PASS — single sticky card. Status icons reuse existing icon vocabulary (○ ◐ ⏸ ✓). No hard-coded colors; uses Tailwind tokens. Validation client-side (collapse state) + server-side (privacy filter, JSON shape). |
| VI. Bảo mật theo role/permission | PASS — no new endpoints. Existing `requireServerUser` continues to gate the SSE stream and the `/api/projects/$projectId/builder-runs/...` routes. |
| VII. Code Review & Impact Analysis | PASS — file-by-file roadmap with explicit deletions in §4. Two dead files deleted with verified zero callers (`BuilderRunProgress.tsx`, `useBuilderRunStream.ts`). |
| VIII. Code Formatting | PASS — `pnpm lint` + `pnpm typecheck` enforced via existing repo hooks. No new tooling. |
| IX. Database JSON Type Convention | PASS — extends existing `json("progress_timeline")` column with two new discriminated-union variants. No `jsonb()` introduced. |
| X. Import Alias Convention | PASS — all new modules import via `@/...` aliases. |

No violations. No entries in Complexity Tracking.

---

## Architecture

### Sequence (complex prompt, plan mode OFF)

```
[user submits prompt]
     │
     ▼
POST /api/projects/$projectId/builder-runs
     │
     ▼
[runStore.create + saveMessage]
     │
     ▼
startBuilderRunForChat(...)
     │
     ▼
runInitBuilderRun | runUpdateBuilderRun | runNewRouteBuilderRun
     │
     ▼ emit milestone "loading_context"
     │
     ▼ (init only) variant clarification → user pick
     │
     ▼
runPlanGenerationPhase(ctx, deps, emit, options)
     │ ┌─────────────────────────────────────────────┐
     │ │ ctx.kind === "init"                          │
     │ │   ? { complexity: "complex", language: "en" }│
     │ │   : await classifyPromptComplexity(...)      │
     │ │                                              │
     │ │ if (complexity === "complex"):               │
     │ │   await generatePlan({ prompt, language })   │
     │ │   on success:                                │
     │ │     handle.taskList = result.tasks           │
     │ │     handle.taskStatuses = all-pending        │
     │ │     emit "plan.created"                      │
     │ │     fireTaskTransitions(handle, emit, "loading_context")  // G1: tick prep tasks active
     │ │   on failure: skip silently (lenient)        │
     │ └─────────────────────────────────────────────┘
     │
     ▼ emit milestone "planning"
     │  → translator: emit "skeleton.update" (existing)
     │
     ▼ emit milestone "creating_draft"
     │  → fireTaskTransitions(handle, emit, "creating_draft")
     │     · prep tasks: active → done
     │     · build tasks: pending → active
     │  → emit plan.task.completed (prep) + plan.task.started (build)
     │
     ▼ [execute turn(s) with retry]
     │
     ▼ emit milestone "checking_preview"
     │  → fireTaskTransitions(handle, emit, "checking_preview")
     │     · build tasks: active → done
     │     · verify tasks: pending → active
     │
     ▼ [optional repair loop — no task transitions fired]
     │
     ▼ emit milestone "publishing"
     │
     ▼ emit "done"
     │  → fireRemainingTasksComplete(handle, emit)
     │     · all non-done tasks: → done
     │
     ▼ run terminal
```

### Cancel mid-plan-generation

```
[user clicks Cancel during classifier or planner turn]
     │
     ▼ AbortController.abort() in BuilderRunHandle
     │
     ▼ classifier/planner Codex turn observes signal
     │  → throws AbortError (existing retry logic NEVER retries AbortError)
     │
     ▼ runPlanGenerationPhase catches AbortError
     │  → re-throws (no fallback path on abort)
     │
     ▼ driver catch block
     │  → emit "cancelled"
     │  → finalize run with status="cancelled", failureCode="cancelled"
```

### Awaiting clarification interaction

```
[driver emits awaiting_clarification (skill or variant)]
     │
     ▼ fireTaskPauseAll(handle, emit)
     │  · for every task with status "active":
     │    · emit "plan.task.paused"
     │    · taskStatuses[id] = "paused"
     │
     ▼ [user submits answer]
     │
     ▼ fireTaskResumeAll(handle, emit)
     │  · for every task with status "paused":
     │    · emit "plan.task.resumed"
     │    · taskStatuses[id] = "active"
     │
     ▼ driver continues execution
```

### UI rendering (sticky card)

```
┌─ chat panel (routes/projects/$projectId.tsx) ─────────────┐
│                                                            │
│  <messages list>                                           │
│    user bubble                                             │
│    agent bubble (with skeleton.update phase indicator)     │
│    ...                                                     │
│  </messages list>                                          │
│                                                            │
│  ┌─ <PlanChecklist> (sticky) ─────────────────────────┐   │
│  │ [▾ ◐ 3/8: Build the cart drawer]    ← header       │   │
│  │ ✓ Analyze user requirements                         │   │
│  │ ✓ Set up project structure                          │   │
│  │ ◐ Build the cart drawer       ← active             │   │
│  │ ○ Add product detail page                           │   │
│  │ ○ Wire checkout flow                                │   │
│  │ ○ Validate preview                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  <MessageComposer> (existing, unchanged)                   │
└────────────────────────────────────────────────────────────┘
```

When `state.activeRun.tasks` is null: the sticky card does not render and the existing single-label progress UI is shown (no change to current behavior).

---

## File Roadmap

### NEW files

| Path | Purpose |
|---|---|
| `src/features/agents/codex/runtime/plan-classifier.server.ts` | LLM call to classify complexity + language. Output schema validation. AbortSignal honored. |
| `src/features/agents/codex/runtime/plan-generator.server.ts` | LLM call to generate task list. Schema + privacy validation, 1 retry, fence stripping (reuse `stripCodeFence` pattern from `design-variants.server.ts`). |
| `src/features/agents/codex/runtime/plan-generation.server.ts` | Helper `runPlanGenerationPhase(ctx, deps, emit, options)` orchestrator: classifier → planner → handle mutation → publish `plan.created` → tick current bucket. |
| `src/features/agents/ui/PlanChecklist.tsx` | React component. Collapsible. Local `useState` for expanded. Full ARIA (G6 C). English UI strings. |
| `tests/unit/plan-classifier.test.ts` | ~5 cases: parse simple/complex, parse language, fallback EN on invalid, fallback complex on invalid, AbortError propagation. |
| `tests/unit/plan-generator.test.ts` | ~6 cases: parse valid JSON, strip fence, retry validation, privacy filter rejection, range 2-8 enforcement, language passed to prompt. |
| `tests/unit/plan-translator.test.ts` | ~5 cases: bucket-enter transition, bucket-exit transition, init bucket→prep, no events for repairing, terminal flush. |
| `tests/unit/chat-stream-reducer-tasks.test.ts` | ~5 cases: plan.created init, started/completed/paused/resumed transitions, run.completed clears tasks. |
| `tests/integration/plan-checklist-end-to-end.test.ts` | 1 case: full driver run with mocked codex thread → progressTimeline contains task_plan + transitions in order → archive replay reproduces same. |

### MODIFIED files

| Path | Changes |
|---|---|
| `src/features/projects/legacy/project-state.schema.ts` | Add `task_plan` + `task_transition` variants to `AgentRunProgressTimelineEvent` discriminated union. |
| `src/features/agents/ui/builder-events.ts` | Add 5 `BuilderRunEvent` variants: `plan.created`, `plan.task.started`, `plan.task.completed`, `plan.task.paused`, `plan.task.resumed`. |
| `src/shared/project-types.ts` | Add 5 `RunStreamEvent` variants matching the BuilderRunEvent additions. Extend `RunUIState` with `tasks` + `taskStatuses`. |
| `src/features/agents/codex/runtime/builder-run-registry.server.ts` | Extend `BuilderRunHandle` with `taskList: Array<...> \| null` + `taskStatuses: Record<string, TaskStatus>`. Initialize in `createBuilderRunHandle`. |
| `src/features/agents/codex/runtime/builder-run.server.ts` | Wire `runPlanGenerationPhase` after `loading_context` (after variant pick for init); add helpers `fireTaskTransitions`, `fireTaskPauseAll`, `fireTaskResumeAll`, `fireRemainingTasksComplete`; call them at each milestone fire site and at clarification pause/resume. Skip plan generation when `ctx.planMode === true`. |
| `src/server/services/builder-run-translator.server.ts` | Add 5 pass-through case mappings. Add `task_plan` + `task_transition` to `ProgressTimelineDirective` union. |
| `src/features/agents/ui/agent-event-reducer.ts` | Add 5 case clauses to `chatStateReducer`. Extend `RunUIState` initial value (run.started initializes empty `tasks=null` + `taskStatuses={}`). |
| `src/features/agents/ui/use-chat-stream.ts` | Add 5 event listeners to the existing event-type loop (lines 166-183). |
| `src/routes/projects/$projectId.tsx` | Mount `<PlanChecklist>` between messages list and composer. Pass `state.activeRun.tasks`, `state.activeRun.taskStatuses`, `state.activeRun === null` (closed flag). |
| `src/routes/api/projects/$projectId/builder-runs/$runId/stream.ts` | Extend `RunForReplay.progressTimeline` union with `task_plan` + `task_transition`. Add replay branches in `buildArchivedReplay` to emit `plan.created` and `plan.task.<transition>` events 1:1. |
| `src/server/repositories/agent-run-repository.ts` | Update `RowToProgressTimelineEvent` type if needed (depends on existing implementation; verify the JSON column passes through unchanged or update parsing). |
| `src/server/functions/progress-mapper.server.ts` | No changes — `isPrivacySafe` already exported and used. |

### DELETED files

| Path | Reason |
|---|---|
| `src/features/agents/ui/BuilderRunProgress.tsx` | Dead code. Never mounted in any route or component (verified via grep across `src/`). |
| `src/features/agents/ui/use-builder-run-stream.ts` | Only consumer is the deleted `BuilderRunProgress`. |
| `src/features/agents/ui/index.ts` | Update — remove the `export * from "./BuilderRunProgress"` and `export * from "./use-builder-run-stream"` lines. |

### Files NOT touched

- `src/features/agents/codex/runtime/plan-mode.server.ts` — plan mode (markdown approval) preserved unchanged. The driver's plan-mode branch already returns before the new wiring point, so no conditional needed there. The new wiring point is only reached when `planMode === false`.
- `src/server/services/chat-event-channel.server.ts` — channel is event-shape-agnostic; no changes needed.
- `src/server/services/builder-run-bridge.server.ts` — translator output already flows through; new event types pass through.
- `src/components/projects/MessageComposer.tsx` — plan mode toggle preserved. No new fields.
- `src/db/schema/agent-runs.schema.ts` — JSON column reused. No SQL migration.
- All routes other than `/projects/$projectId.tsx` and `/builder-runs/$runId/stream.ts`.

---

## Phase Summary

### Phase 1: Foundational schemas & types
Extend types/discriminated unions for events, timeline variants, and handle state. Pure type changes.

### Phase 2: Server-side LLM modules
Implement classifier, planner, and helper orchestrator. Unit tests for each.

### Phase 3: Driver wiring
Add helpers for milestone bucket transitions, pause/resume on clarification, and remaining-task flush on terminal. Wire `runPlanGenerationPhase` into all three drivers.

### Phase 4: Bridge translator
Add pass-through cases. Update `ProgressTimelineDirective` union. Unit test bucket transitions.

### Phase 5: Frontend reducer + hook
Extend reducer with 5 task event cases. Add 5 listeners in `useChatStream`. Unit test reducer transitions.

### Phase 6: Frontend UI component
Implement `<PlanChecklist>`. Mount in project route between messages and composer. Visual verification on dev.

### Phase 7: Archive replay
Extend stream route's `buildArchivedReplay` to replay task events from progressTimeline.

### Phase 8: Cleanup
Delete `BuilderRunProgress.tsx` + `useBuilderRunStream.ts` + index.ts re-exports. Verify build clean.

### Phase 9: Integration test + manual verification
Run integration test end-to-end. Run quickstart manual checklist on dev. Capture screenshots.

---

## Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| LLM returns invalid JSON repeatedly | Medium | 1 validator retry + lenient fallback. No fail run. Logged via `plan_generator_validation_failed`. |
| Classifier mislabels complex prompts as simple → user misses checklist | Low-Medium | Default to complex on invalid (FR-001 fallback). Log decision for post-deploy analysis (`plan_classifier_decision`). |
| Privacy filter false-rejects legitimate task titles in user language | Low | Filter checks framework tokens + paths only — language-agnostic. If false-reject occurs, retry-once + lenient fallback hides it. |
| Publish-first ordering causes phantom state on crash | Documented | Trade-off documented in FR-006 and code comment. Live FE may diverge from archive replay after a crash; user retry creates new run. |
| `BuilderRunProgress` deletion breaks something we didn't find | Very Low | Grep verified zero callers. Build will fail if any caller exists. |
| Single-flight constraint blocks concurrent plan generation | N/A | Already enforced by `activeByProject`; one run at a time per project. |
| Skeleton + checklist visual conflict on small screens | Low | Skeleton is per-message in bubble; checklist is run-level sticky card — non-overlapping visual areas. Collapse default expanded; user can toggle. |
| Init flow gets task list with stale variant context | None | Helper accepts `promptOverride` parameter; init driver passes prompt + selected variant after variant pick. |

---

## Validation Plan

| Layer | Verification |
|---|---|
| Type system | `pnpm typecheck` clean after each phase. |
| Unit | `pnpm vitest run tests/unit/plan-*.test.ts tests/unit/chat-stream-reducer-tasks.test.ts`. ≥ 12 cases pass. |
| Integration | `pnpm vitest run tests/integration/plan-checklist-end-to-end.test.ts`. 1 case pass. |
| Lint | `pnpm lint` clean. |
| Manual smoke (quickstart.md) | Run a complex prompt, observe checklist appears, expand/collapse, verify task transitions. Run a simple prompt, observe NO checklist. Toggle plan mode, verify no checklist. Reload mid-run, verify replay restores statuses. |

## Out of Scope

- Multi-language UI infrastructure (status labels, ARIA strings, header text remain English hardcoded). Future i18n migration is out of scope.
- Resume/checkpoint capability for interrupted runs (covered by retry → new run pattern).
- Backfill of task lists for completed runs persisted before deploy (FR-017).
- Showing repair-loop iterations as task transitions (G6 decision: subtle header badge only, deferred).
- Mobile-specific layout changes beyond default expanded + collapse-on-click. Responsive auto-collapse below `md:` breakpoint deferred.
- Plan mode auto-generating a task list after approval (G16 mới decision: plan-mode skips task list).
