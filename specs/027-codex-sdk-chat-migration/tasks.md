---

description: "Task list for codex SDK chat migration"
---

# Tasks: Codex SDK Chat Migration

**Input**: Design documents from `/specs/027-codex-sdk-chat-migration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Vitest contract + integration + unit suites are REQUIRED for this migration (Constitution Principle II + grill-me decision R11). Test tasks are interleaved with implementation per phase.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Setup + Foundational phases set up the safety net Phases 1–4 of the migration plan, then user-story phases land in priority order. Frontend migration (Phase 2 of the migration) is captured as cross-cutting infrastructure, scheduled BEFORE plan-mode/variant UIs so they have a host to render into.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1..US6) — only on user-story phases
- File paths are absolute or repo-rooted

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm environment, capture pre-migration baseline, freeze legacy behavior so phase rollbacks stay safe.

- [x] T001 Run baseline verification: `pnpm install`, `pnpm typecheck`, `pnpm vitest run` from repo root and record any pre-existing failures.
- [x] T002 Capture a pre-migration screenshot/log of the original bug repro (chat prompt "thêm image vào hero" against the legacy path) under `specs/027-codex-sdk-chat-migration/baseline/` so SC-001 has a reference.
- [x] T003 [P] Tag the legacy state for rollback safety: `git tag pre-027-migration` on the current `main` HEAD.
- [x] T004 [P] Add an `.env.local` documentation snippet to `specs/027-codex-sdk-chat-migration/quickstart.md` listing the codex SDK envs the migration depends on (no secrets — names only): `CODEX_API_KEY`, `CODEX_BASE_URL`, `CODEX_HOME`, `CODEX_MODEL`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Stand up the persistence, mapper, classifier, and codex thread wiring that ALL user stories depend on. This is migration Phase 0.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Database schema (additive `json()` per Constitution IX)

- [x] T005 Add Drizzle migrations for `agent_runs` additive columns in `src/db/schema.ts`: `kind` enum (`init|update|new_route`), `status` extension (`interrupted`), `failure_code` extension (`interrupted_by_restart`), `progress_timeline json()` default `[]`, `plan_phase json()` default `null`, `clarification_snapshot json()` default `null`. Run `pnpm db:generate`.
- [x] T006 Apply the migration locally (`pnpm db:migrate`) and verify by inserting a synthetic row via `pnpm tsx`.
- [x] T007 [P] Update `src/shared/project-types.ts` with additive types per `data-model.md`: extend `AgentMessageKind` to include `"plan"` (already present) but document semantics; add `BuilderRunKind` re-export, `ProgressTimelineEvent`, `PlanPhase`, `ClarificationSnapshot`, `DesignVariant.preview` exact shape.

### Repository + restart-safe boot scan

- [x] T008 Extend `src/server/repositories/agent-run-repository.ts` with read/write helpers for `progressTimeline`, `planPhase`, `clarificationSnapshot`, `kind`, and `status="interrupted"`. Keep existing API; add new methods only.
- [x] T009 Add boot-scan helper `reconcileOrphanRuns()` in `src/server/repositories/agent-run-repository.ts` that flips `streaming` rows without an in-memory handle to `failed/interrupted_by_restart` and reconstructs `awaiting_clarification` rows for SSE replay.
- [x] T010 Wire `reconcileOrphanRuns()` into the server bootstrap path (search for the existing service registry / app start hook; add a single call before the HTTP server begins listening).
- [x] T011 [P] Unit test the repository round-trip in `tests/unit/agent-run-repository.test.ts`: write+read each new column, drop+restore round-trip, FIFO cap on `progress_timeline` at 200 items.
- [x] T012 [P] Unit test `reconcileOrphanRuns()` in `tests/unit/reconcile-orphan-runs.test.ts`: scenarios for streaming-no-handle → interrupted, awaiting_clarification → recoverable, terminal → no-op.

### Codex thread reasoning effort wiring (R1)

- [x] T013 Extend `BuilderRunContext` in `src/features/agents/codex/runtime/builder-run.server.ts` to include `reasoningEffort: ComposerReasoningEffort | null` and `planMode: boolean`.
- [x] T014 Update `createBoundedCodexThread` in `src/features/agents/codex/runtime/codex-thread.server.ts` to accept and forward `modelReasoningEffort` and `sandboxMode` into `codex.startThread`.
- [x] T015 [P] Unit test the wiring in `tests/unit/codex-thread-options.test.ts`: assert that `low|medium|high|xhigh` map 1:1 to `ModelReasoningEffort`, sandbox toggle is honored.

### Init kind detection (R5)

- [x] T016 Add `resolveBuilderRunKind({ project, workspaceFiles, prompt }): BuilderRunKind | "unsupported"` in `src/features/agents/codex/runtime/update-classifier.server.ts`. Logic: empty workspace OR `project.status === "draft"` → `init`; otherwise call existing `classifyUpdatePrompt`.
- [x] T017 [P] Unit test `resolveBuilderRunKind` in `tests/unit/resolve-builder-run-kind.test.ts`: covers empty workspace, draft project, populated project + update prompt, populated project + new-route prompt, populated project + unsupported prompt.

### Progress mapper + privacy filter (R6 / FR-006..FR-009 / SC-002)

- [x] T018 Create `src/server/functions/progress-mapper.server.ts` exporting `phaseLabel(phase, locale)`, `fileChangeToSection(path, locale)`, `extractSummary(text, locale)`, `isPrivacySafe(text)`. Implement the γ table in `contracts/progress-events.md` exactly.
- [x] T019 [P] Unit test the γ table in `tests/unit/progress-mapper-gamma.test.ts`: every row in `contracts/progress-events.md` table → expected output; unmapped paths → `null`.
- [x] T020 [P] Unit test phase α labels in `tests/unit/progress-mapper-alpha.test.ts`: every milestone in both `vi` and `en` locales matches the contract.
- [x] T021 [P] Unit test the privacy filter in `tests/unit/progress-mapper-privacy.test.ts`: 50-string adversarial corpus (file paths, code fences, identifiers, framework tokens) all return `false`; 20-string clean corpus all return `true`.
- [x] T022 [P] Unit test β-lite extraction in `tests/unit/progress-mapper-beta-lite.test.ts`: clean candidate passes through, dirty candidate falls back to phase-default per locale.

### Foundational checkpoint

- [x] T023 Run `pnpm typecheck` and `pnpm vitest run` and ensure all new tests pass before moving on.

**Checkpoint**: Foundation ready. User-story work can begin.

---

## Phase 3: User Story 1 - Hero image update produces a working preview (Priority: P1) 🎯 MVP

**Goal**: Killing the original bug. After Phase 3, the chat composer at `/projects/$projectId` produces working preview updates when the user prompts an update; the preview never shows a Vite parser error.

**Independent Test**: Submit "thêm image vào hero" against an initialized project. The preview reloads cleanly and the new image is visible. Reload — chat history persists.

### Tests for User Story 1 ⚠️

- [x] T024 [P] [US1] Contract test in `tests/contract/builder-bridge.contract.test.ts`: with a stub `BoundedCodexThread` that yields scripted events (`milestone`, `file_change(src/routes/index.tsx)`, `turn.completed`), assert the translator emits the matching `RunStreamEvent` sequence (`run.started`, `skeleton.update("loading_context")`, `skeleton.update("editing", section="trang chủ")`, `message.created({kind:"answer"})`, `message.delta`, `message.completed`, `run.completed`).
- [x] T025 [P] [US1] Integration test in `tests/integration/us1-hero-update.test.ts`: end-to-end run through `MessageService.driveRun` with stub codex thread; assert preview restart event fires, persisted message has `kind="answer"` and `provider="codex-sdk"`, `progress_timeline` is non-empty.

### Implementation for User Story 1 (migration Phase 1 — bridge)

- [x] T026 [US1] In `src/server/services/message-service.ts`, replace the body of `runOrchestrator` to: (1) call `resolveBuilderRunKind`, (2) build `BuilderRunContext`, (3) start the chosen driver (`runInitBuilderRun` / `runSmallUpdateBuilderRun` / `runNewRouteBuilderRun`), (4) translate `BuilderRunHandle` events to `RunStreamEvent` per `contracts/progress-events.md`, (5) persist β-lite answer as `Message{ kind: "answer" }`. Keep the existing `RunStreamEvent` shape so the frontend is unchanged.
- [x] T027 [US1] Add a translator helper `translateBuilderEventToRunStreamEvent(event, ctx)` in `src/server/services/message-service.ts` (or co-located helper file) that reuses `phaseLabel` / `fileChangeToSection` / `extractSummary` and runs final text through `isPrivacySafe`.
- [x] T028 [US1] Wire the runStore writes inside the translator to push every emitted event into `agent_runs.progress_timeline` (capped) and update `agent_runs.status` on terminal events.
- [x] T029 [US1] Persist the user prompt as `Message{ role: "user", kind: undefined }` (existing behavior) and ensure the new run record carries `kind` (resolved by T016) and `reasoningEffort` end-to-end.
- [x] T030 [US1] Run `pnpm typecheck` and `pnpm vitest run`; smoke the bug repro from `quickstart.md` Phase 1 section. Confirm the preview reloads without parser errors.

**Checkpoint**: SC-001 satisfied for the legacy chat surface. The bug class is dead even though the frontend has not migrated yet (FR-026).

---

## Phase 4: User Story 2 - Progress feedback respects code/structure privacy (Priority: P1)

**Goal**: Lock in the privacy guarantee. Foundation already shipped the filter; this phase verifies it across realistic runs.

**Independent Test**: Capture every user-visible event over 10 successful runs and 5 failure runs; zero events contain file paths, file extensions, code identifiers, or framework tokens.

### Tests for User Story 2 ⚠️

- [x] T031 [P] [US2] Integration test in `tests/integration/us2-privacy-progress.test.ts`: drive 10 stub runs that emit a mix of mapped + unmapped + adversarial file changes and assert that every chat message + every `skeleton.update.label` + every β-lite summary passes `isPrivacySafe`.
- [x] T032 [P] [US2] Contract test in `tests/contract/error-friendly-content.contract.test.ts`: every `BuilderRunFailureCode` maps to a friendly Vietnamese-default message via the translator; no raw error frames leak.

### Implementation for User Story 2

- [x] T033 [US2] Centralize friendly-error mapping in a new module `src/server/functions/friendly-errors.server.ts` keyed by `BuilderRunFailureCode` (per the table in `contracts/builder-runs.md`). Import from the translator.
- [x] T034 [US2] Replace any direct usage of raw codex error messages in `src/features/agents/codex/runtime/builder-run.server.ts` event emission with the friendly mapping (only on user-visible payloads; raw errors still log internally for audit).

**Checkpoint**: SC-002 verifiable; FR-006..FR-009 enforced end-to-end.

---

## Phase 5: Frontend Migration to `/builder-runs` (Cross-Cutting Infrastructure)

**Purpose**: Move the chat composer + chat panel onto the `/api/projects/$projectId/builder-runs` API. This is migration Phase 2; it must land before US3/US4/US5 because they introduce new chat UI components.

> NOTE: This phase has NO `[Story]` label because it underlies US3, US4, US5. It does not implement a single user story by itself; it is the wiring that lets later stories ship UI changes.

### API surface extension

- [x] T035 Extend `POST /api/projects/$projectId/builder-runs` (`src/routes/api/projects/$projectId/builder-runs/index.ts`) to: (a) reject `body.kind` from clients, (b) call `resolveBuilderRunKind`, (c) persist a user `Message` and an `agent_runs` row before kicking off the driver, (d) return the run-created envelope per `contracts/chat-api.md` Phase 2 spec.
- [x] T036 Extend `POST /api/projects/$projectId/builder-runs/$runId/answer` (`src/routes/api/projects/$projectId/builder-runs/$runId/answer.ts`) to accept `{ optionId | freeText | planAction }`. Validate that `planAction` only resolves when `agent_runs.plan_phase.stage === "plan_ready"`.
- [x] T037 [P] Add `GET /api/projects/$projectId/messages` route file at `src/routes/api/projects/$projectId/messages.ts` that pages messages via `messageRepository.listMessages`. Return the existing `MessagePage` shape.
- [x] T038 Extend SSE stream `src/routes/api/projects/$projectId/builder-runs/$runId/stream.ts` to replay events from `agent_runs.progress_timeline` when the in-memory handle is missing (R4 + Progress Events contract §SSE replay).

### Frontend hook + composer rewire

- [x] T039 Create `src/features/agents/ui/use-chat-stream.ts` exporting `useChatStream({ projectId })` that owns: chat-history fetch (`/api/projects/$projectId/messages`), POST `/api/projects/$projectId/builder-runs`, SSE subscribe to the run stream, optimistic message insert on send, retry/stop wiring.
- [x] T040 Update `src/routes/projects/$projectId.tsx` to consume `useChatStream` instead of `useAgentStream`. Remove the `createProjectRun` server-fn call path (it stays in code until Phase 9 cleanup but is no longer called from this route).
- [x] T041 [P] Reuse the existing reasoning-effort selector + plan-mode toggle in the composer; bind their values to `useChatStream` POST body. Keep the toggle visible even before Phase 6 plan-mode lands; until then, server still routes through US1 path (toggle is inert at the server side until T053).
- [x] T042 [P] Wire the existing Stop button to `POST /api/projects/$projectId/builder-runs/$runId/cancel` and the existing Retry button to `POST /api/projects/$projectId/builder-runs/$runId/retry` (defaulting `reasoningEffort` from the prior run).

### Tests + verification

- [x] T043 [P] Contract test `tests/contract/builder-runs-post.contract.test.ts`: `POST /builder-runs` rejects `body.kind`, persists the user message + run, returns the envelope. Snapshot fields, not full shape.
- [x] T044 [P] Integration test `tests/integration/frontend-chat-routes.test.ts`: open the project page mounted with `useChatStream`, send a prompt, assert that POST is sent to `/builder-runs`, SSE is opened on the new path, and chat history is loaded from `/messages`.
- [x] T045 Run `pnpm typecheck` and `pnpm vitest run` and a manual smoke per `quickstart.md` Phase 2.

**Checkpoint**: Frontend chat speaks `/builder-runs`. The legacy `/runs` route still works (Phase 1 bridge), but the active UI no longer hits it. This is the prerequisite for US3/4/5 UI work.

---

## Phase 6: User Story 3 - Plan mode 2-phase workflow (Priority: P2)

**Goal**: Toggling plan mode produces a structured plan first; the user explicitly Approves or Rejects before any file change.

**Independent Test**: Submit a non-trivial prompt with plan mode on. Assert (a) plan markdown lands in chat with all required sections, (b) `git diff` (or workspace snapshot) shows zero changes, (c) Approve triggers an execute turn that mutates files, (d) Reject ends the run cleanly.

### Tests for User Story 3 ⚠️

- [x] T046 [P] [US3] Unit test in `tests/unit/plan-mode-prompt.test.ts`: the prompt template renders with the user task interpolated, contains both required sentences ("Your output must be a plan, not an implementation." and "Do not include full code patches unless explicitly asked."), preserves the seven section headings.
- [x] T047 [P] [US3] Integration test in `tests/integration/us3-plan-mode-approve.test.ts`: scripted plan turn → assert workspace snapshot diff is empty, awaiting_clarification fires with `questionType="plan_review"`; Approve fires; execute turn runs and mutates files.
- [x] T048 [P] [US3] Integration test in `tests/integration/us3-plan-mode-reject.test.ts`: same setup; Reject ends the run with `failureCode="cancelled"` and zero workspace change.
- [x] T049 [P] [US3] Contract test in `tests/contract/plan-action-answer.contract.test.ts`: `POST /builder-runs/$runId/answer` with `{ planAction: "approve" | "reject" }` only resolves when `plan_phase.stage === "plan_ready"`; otherwise 409.

### Implementation for User Story 3

- [x] T050 [US3] Create `src/features/agents/codex/runtime/plan-mode.server.ts` exporting `runPlanTurn(ctx)` and `runExecuteTurn(ctx, planMarkdown)`. `runPlanTurn` builds a fresh thread with `sandboxMode: "read-only"`, `modelReasoningEffort: "xhigh"`, runs the prompt template from R3, captures `Turn.finalResponse` as planMarkdown, and writes `agent_runs.plan_phase = { stage: "plan_ready", planMarkdown, planTurnDoneAt, planThreadId }`.
- [x] T051 [US3] In the same module, `runExecuteTurn` opens a NEW thread (sandbox `workspace-write`, reasoning effort from `ctx.reasoningEffort`), seeds the first turn prompt with `Original task + Approved plan`, then delegates to the existing execute flow (snapshot, diff gate, repair loop, validation, promotion gate). Update `agent_runs.plan_phase.stage = "executing"`.
- [x] T052 [US3] Hook plan-mode routing into `runSmallUpdateBuilderRun` / `runNewRouteBuilderRun` (`src/features/agents/codex/runtime/builder-run.server.ts`): when `ctx.planMode === true` AND `ctx.kind !== "init"`, run `runPlanTurn` first, await clarification answer, then either `runExecuteTurn` (approve) or terminate run (reject).
- [x] T053 [US3] Activate the composer plan-mode toggle: ensure POST body forwards `planMode: true` and that T035 persists it on the `agent_runs` row.
- [x] T054 [US3] Persist the plan markdown as `Message{ kind: "plan", metadata: { planPhase: "plan_ready" } }` when the plan turn completes; on reject, update to `metadata: { planPhase: "plan_rejected" }`.
- [x] T055 [US3] Add the abort guard: if `runPlanTurn` produces any `file_change` item, abort the run with `failureCode: "blocked_request"`.
- [x] T056 [US3] Build `src/features/agents/ui/PlanReview.tsx`: render `planMarkdown` as markdown (existing renderer) and show Approve / Reject buttons that POST `{ planAction }` to `/builder-runs/$runId/answer`.
- [x] T057 [US3] Render `PlanReview` from the chat panel when `metadata.questionType === "plan_review"` (handled inside `useChatStream` reducer).

**Checkpoint**: SC-006 holds across at least 5 plan runs in the dev project. US3 acceptance scenarios all pass.

---

## Phase 7: User Story 4 - Init flow offers four retail-vibe design variants (Priority: P2)

**Goal**: Brand-new project init produces 4 retail-style variants, the user picks one, the agent builds against the pick.

**Independent Test**: Initialize a fresh project. Observe 4 variant cards with palette dots + 1-line description. Pick one — the build reflects the chosen palette/typography. Custom-text answer also works.

### Tests for User Story 4 ⚠️

- [x] T058 [P] [US4] Unit test in `tests/unit/design-variant-schema.test.ts`: validate strict JSON schema (4 variants exactly, palette length 3..5, hex format, description ≤ 120 chars and privacy-safe).
- [x] T059 [P] [US4] Integration test in `tests/integration/us4-design-variants.test.ts`: scripted codex turn returns 4 variants → `awaiting_clarification` event with `questionType="design_variant"` fires → answer with `optionId` resumes; assert chosen variant id is persisted on `clarification_snapshot.selectedOptionId` and seeded into the build prompt.
- [x] T060 [P] [US4] Integration test in `tests/integration/us4-design-custom-answer.test.ts`: same setup; answer with `freeText` resumes and seeds the build prompt with the custom text.

### Implementation for User Story 4

- [x] T061 [US4] Create `src/features/agents/codex/runtime/design-variants.server.ts` exporting `generateRetailVariants(ctx)`. Internally: a fresh codex thread (sandbox `read-only`, `modelReasoningEffort: "high"`), prompt anchored to skill `design-taste-frontend` + a new prompt asset describing four retail vibes (minimalist retail / warm retail / luxury retail / playful retail), `outputSchema` enforcing the `DesignVariant` array of length 4. On JSON validation failure, retry once.
- [x] T062 [US4] Add a curated prompt asset at `.specify/templates/codex-builder/init/retail-variants.md` (or equivalent existing asset folder) with few-shot examples: each variant has a label, description, palette (3-5 hex), font, motion intensity. Reference it from the prompt builder.
- [x] T063 [US4] Hook `generateRetailVariants` into `runInitBuilderRun` (`src/features/agents/codex/runtime/builder-run.server.ts`): after `loadFoundationInstructions` but before `building_pages`, call the variant generator, emit `awaiting_clarification` with the variant payload, await answer.
- [x] T064 [US4] On answer: persist `clarification_snapshot.selectedOptionId` (or `selectedFreeText`), append the chosen variant's preview tokens to the build prompt, then continue the existing init build flow.
- [x] T065 [US4] Build `src/features/agents/ui/DesignVariantPicker.tsx`: render 4 cards each with label, 1-line description, palette dots (CSS only — no font preview, no motion demo). Show "Custom" textarea for free-text. POST `{ optionId | freeText }` to `/builder-runs/$runId/answer`.
- [x] T066 [US4] Render `DesignVariantPicker` from the chat panel when `metadata.questionType === "design_variant"`.

**Checkpoint**: US4 acceptance scenarios pass. Four variants visible, retail-vibe consistent across runs.

---

## Phase 8: User Story 5 - Skill clarification renders as a simple list (Priority: P3)

**Goal**: For non-design clarifications, the chat shows a simple list — visually distinct from variant cards.

**Independent Test**: Trigger a skill clarification. Confirm a simple list appears (label per option), pick one, run continues.

### Tests for User Story 5 ⚠️

- [x] T067 [P] [US5] Integration test in `tests/integration/us5-skill-clarification.test.ts`: scripted codex turn emits `awaiting_clarification` with `questionType="skill_clarification"` and id+label options → answer with `optionId` resumes; assert UI render path differs from `DesignVariantPicker`.

### Implementation for User Story 5

- [x] T068 [US5] Build `src/features/agents/ui/SkillClarificationList.tsx`: render a simple radio-list of options (label only). On select, POST `{ optionId }` to `/builder-runs/$runId/answer`.
- [x] T069 [US5] Update the chat panel switch (in `useChatStream` reducer or render layer) to dispatch by `metadata.questionType`: `"design_variant"` → `DesignVariantPicker`, `"skill_clarification"` → `SkillClarificationList`, `"plan_review"` → `PlanReview`.
- [x] T070 [US5] Verify the existing clarification emission in `runSkillSelection` (`src/features/agents/codex/runtime/builder-run.server.ts`) populates `metadata: { questionType: "skill_clarification", options }` correctly.

**Checkpoint**: US5 acceptance scenarios pass.

---

## Phase 9: User Story 6 - In-flight runs survive process restart safely (Priority: P3)

**Goal**: Server restart mid-run leaves the chat in a recoverable state — interrupted with a retry, or awaiting-clarification recovered.

**Independent Test**: Start a run, kill the server, restart, reload chat. Run shows interrupted state with retry. Awaiting-clarification state recovers and remains answerable. A retry succeeds.

### Tests for User Story 6 ⚠️

- [x] T071 [P] [US6] Integration test in `tests/integration/us6-restart-streaming.test.ts`: simulate streaming row + missing handle on boot → `reconcileOrphanRuns` flips it to `failed/interrupted_by_restart`; SSE returns terminal failed event when reconnected.
- [x] T072 [P] [US6] Integration test in `tests/integration/us6-restart-clarification.test.ts`: simulate awaiting_clarification row + missing handle on boot → handle reconstructed from `clarification_snapshot`; SSE replay surfaces the awaiting-clarification event so UI re-renders the picker.
- [x] T073 [P] [US6] Integration test in `tests/integration/us6-retry-after-restart.test.ts`: after T071 path, calling `/builder-runs/$runId/retry` starts a fresh run that completes normally.

### Implementation for User Story 6

- [x] T074 [US6] Ensure `reconcileOrphanRuns` (T009) emits friendly events on the rebuilt handles (so SSE replay is meaningful). Update `friendly-errors.server.ts` for `interrupted_by_restart` copy.
- [x] T075 [US6] In the chat UI render path, when the SSE first event is `failed/interrupted_by_restart`, show the existing retry button prominently (no new UI; reuse).
- [x] T076 [US6] Confirm awaiting-clarification recovery wires `clarificationPrompt` from `clarification_snapshot` on handle rebuild (extend `createBuilderRunHandle` or its reconciler).

**Checkpoint**: US6 + SC-008 verified.

---

## Phase 10: Polish & Cross-Cutting Concerns (Big-Bang Cleanup)

**Status: COMPLETED 2026-06-07 (with documented scope reduction).**

The original spec for T079 said "Delete `src/features/ai-agent/` (entire directory)." When the gate condition was checked, 21 callers outside that directory were found, including non-chat production code. A whole-directory delete would break the build. Per execution rules ("If blocked … STOP and surface the blocker"), the user approved a **scoped chat-only cleanup**: delete the legacy chat orchestrator path while preserving shared utilities. See `baseline/post-migration-report.md` for the full deviation note.

What was deleted:
- legacy chat orchestrator under `src/features/ai-agent/agent/**` (18 files)
- `src/features/ai-agent/{api,thinking}/**` minus `thinking.schema.ts` (which `agentic-loop.types.ts` imports)
- `src/features/ai-agent/ui/{use-agent-stream, streaming-text-panel}` (the other 3 UI files moved to `src/features/agents/ui/`)
- `src/server/services/message-service.ts`
- `src/server/functions/project-runs.ts`
- `src/routes/api/projects/$projectId/runs/**`

What was preserved (load-bearing for non-chat code paths):
- `src/features/ai-agent/{security, code-tools, openai, planning, store-runtime, design}`
- `src/features/ai-agent/agent/{agent-events, agent-errors, agentic-loop.types, error-classifier, prompt-template-store}.ts`

A future cleanup spec can extract these shared utilities and remove `ai-agent/` entirely (SC-005 fully satisfied). The Phase 10 guard test (`tests/contract/no-legacy-chat-path.contract.test.ts`) keeps the chat orchestrator from being recreated.

- [x] T077 Run a code-graph review across `src/features/ai-agent/**`. Result: 14 external callers, of which 4 chat-only (migrated/deleted) and 10 non-chat production callers (preserved).
- [x] T078 Tag rollback snapshot: `git tag legacy-aiagent-snapshot HEAD` before the cleanup commit.
- [x] T079 Delete the legacy chat orchestrator path (scoped — see deviation note above).
- [x] T080 Delete `src/routes/api/projects/$projectId/runs/` (entire route subtree) — done.
- [x] T081 Delete `src/server/services/message-service.ts`; replaced by slim `ChatHistoryService` for the surviving `getProjectMessages` + `runStore` accessors.
- [x] T082 Verify-and-delete pass: `project-runs.ts` deleted; `project-run-store.server.ts`, `runtime-events`, `project-message-stream.ts` retained because non-chat callers exist (documented).
- [x] T083 Update `src/routes/projects/$projectId.tsx` to remove leftover `useServerFn(createProjectRun/retryProjectRun/stopProjectRun)` declarations and the import block.
- [x] T084 Run `pnpm typecheck` + `pnpm vitest run` — clean / 377 pass.
- [x] T085 [P] Update `CLAUDE.md` to reflect the new chat path and warn against recreating the legacy orchestrator.
- [x] T086 Add automated guard `tests/contract/no-legacy-chat-path.contract.test.ts` — 4 cases pass.
- [x] T087 Record outcome in `specs/027-codex-sdk-chat-migration/baseline/post-migration-report.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) → Foundational (Phase 2) → US1 (Phase 3) → US2 (Phase 4) → Frontend Migration (Phase 5) → US3 (Phase 6) → US4 (Phase 7) → US5 (Phase 8) → US6 (Phase 9) → Polish (Phase 10).
- US1 (P1) blocks ALL other user stories: it ships the bridge that everything else mutates.
- US2 (P1) shares foundation with US1 and is verified immediately after.
- Frontend Migration (Phase 5) blocks US3, US4, US5 because they need new chat UI.
- US3 (P2) blocks US4 only by code locality (`builder-run.server.ts` co-edits); both can proceed in parallel by separate developers if conflicts are managed.
- US6 (P3) depends only on Foundational; can run in parallel with US3/US4/US5 if staffed.
- Polish (Phase 10) requires every story complete and a clean code-graph review.

### Within Each User Story

- Tests are written first and MUST fail before implementation.
- Models / contracts → service layer → endpoints / UI.
- Run `pnpm typecheck` + `pnpm vitest run` before checking off the phase checkpoint.

### Parallel Opportunities

- Foundational tests T011–T012, T015, T017, T019–T022 can run in parallel — different files, no shared mutation.
- US1 tests T024–T025 in parallel with each other.
- US2 tests T031–T032 in parallel.
- US3 tests T046–T049 in parallel.
- US4 tests T058–T060 in parallel.
- US5 + US6 can be worked in parallel by separate developers.
- Polish tasks T085 in parallel with T086 (different files).

---

## Parallel Example: User Story 1

```bash
# Launch US1 tests first (must FAIL before T026 lands):
Task: "Contract test for the builder-bridge translator in tests/contract/builder-bridge.contract.test.ts"
Task: "Integration test for the hero-update path in tests/integration/us1-hero-update.test.ts"

# Then implementation in dependency order:
Task: "Replace runOrchestrator body in src/server/services/message-service.ts (T026)"
Task: "Add translator helper in src/server/services/message-service.ts (T027)"
Task: "Wire runStore writes (T028)"
Task: "Persist run record with kind + reasoningEffort (T029)"
```

---

## Implementation Strategy

### MVP First (Phase 1 → 4)

1. Setup (Phase 1) + Foundational (Phase 2) → repository + mapper + classifier + reasoning wiring.
2. US1 (Phase 3) → bridge inside `MessageService` kills the original bug.
3. US2 (Phase 4) → privacy guarantee verified.
4. **STOP and VALIDATE** at the Phase 4 checkpoint. The MVP is shippable: bug killed, privacy enforced, reasoning effort end-to-end.

### Incremental Delivery After MVP

1. Phase 5 (Frontend Migration) → chat UI now speaks `/builder-runs`. No user-visible regression.
2. Phase 6 (US3 plan mode) → toggle becomes meaningful.
3. Phase 7 (US4 retail variants) → init flow gains visual lite picker.
4. Phase 8 (US5 skill clarification) → simple-list UI for skill-only clarifications.
5. Phase 9 (US6 restart safety) → recovered awaiting-clarification + interrupted retry.
6. Phase 10 (cleanup) → delete legacy code in one PR.

### Parallel Team Strategy

- After Phase 4 closes, two developers can fork:
  - Developer A: Phase 5 → 6 → 7 (frontend migration → plan mode → variants).
  - Developer B: Phase 9 (restart-safety integration tests + UI affordance).
- Phase 8 (US5) is small enough that whichever developer is free picks it up.
- Phase 10 cleanup is owned by a single reviewer.

---

## Notes

- [P] tasks operate on disjoint files. Two tasks on `builder-run.server.ts` are NEVER parallelized (T013, T052, T063 must serialize).
- Each user story checkpoint is a deploy candidate — the chat must remain functional at every checkpoint (FR-028).
- Constitution IX: every new column is `json()`. Reviewer rejects PR if `jsonb()` slips in.
- Constitution X: every new module imports via `@/...` aliases.
- Vitest run + typecheck before merging each phase. The Phase 10 cleanup PR runs the chat smoke at the dev project as the final gate.
