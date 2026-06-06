# Tasks: Codex SDK Migration

**Input**: Design documents from `/specs/025-codex-sdk-migration/`
**Prerequisites**: plan.md, spec.md, docs/codex-sdk-migration-grill-summary.md, skill-runtime-discussion-summary.md

**Tests**: Required (Constitution Principle II) for boundary enforcement (FR-016), validation gates (FR-025), repair loop (FR-027), product-sample parser (FR-031–FR-033), preview health (FR-029), retention scheduler (FR-015), milestone mapper (FR-039). Other tests are optional.

**Organization**: Tasks grouped by user story (US1–US8) for independent implementation. Foundational phase blocks all stories.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Different file, no dependency on another in-flight task in the same phase.
- **[Story]**: `[US1]`–`[US8]` for user-story phase tasks; absent for Setup, Foundational, Polish.
- File paths are absolute relative to repo root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Migrate retail templates into the unified `templates/codex-builder/*` layout, add the Codex SDK dependency, scaffold the new module tree, and wire feature-availability gating. Phase 0 (spec, plan, grill sync, deploy doc) is already done — not in this list.

- [x] T001 `git mv` retail foundation templates from `templates/agent-system/{retail-constraints,reasoning-workflow,edit-system}.md` to `templates/codex-builder/foundation/{retail-constraints,reasoning-workflow,edit-system}.md`
- [x] T002 `git mv` init templates: `templates/init-prompt/system.md` → `templates/codex-builder/init/system.md`; `templates/agent-system/init-mode.md` → `templates/codex-builder/init/init-mode.md`; `templates/init-prompt/manifest.json` → `templates/codex-builder/init/manifest.json`
- [x] T003 `git mv` init data templates `templates/init-prompt/{catalog-data,data,packages,provider,component}.md` → `templates/codex-builder/init/data/{catalog-data,data,packages,provider,component}.md`
- [x] T004 `git mv` init page templates `templates/init-prompt/{home-page,products-page,product-detail-page,cart-page,checkout-page,orders-page,order-detail-page}.md` → `templates/codex-builder/init/pages/{home,products,product-detail,cart,checkout,orders,order-detail}.md`
- [x] T005 `git mv` recovery templates `templates/init-recovery/{recovery,server-design-guidance,vertical-guidance}.md` → `templates/codex-builder/recovery/{recovery,server-design-guidance,vertical-guidance}.md`
- [x] T006 `git mv` redesign templates `templates/redesign/{anti-slop-repair,redesign-rewrite,token-patch-rewrite}.md` → `templates/codex-builder/redesign/{anti-slop-repair,redesign-rewrite,token-patch-rewrite}.md`
- [x] T007 Update every reference to old template paths inside `src/features/ai-agent/**` to point at the new `templates/codex-builder/*` layout (interim; the AI agent runtime itself is deleted in Polish)
- [x] T008 Add `@openai/codex-sdk` to `package.json` dependencies and run `pnpm install` to refresh `pnpm-lock.yaml`
- [x] T009 [P] Create empty module skeleton folders and `index.ts` barrels under `src/features/agents/codex/{runtime,context,boundary,validation,retention,events,api}` and `src/features/agents/ui`
- [x] T010 [P] Add Codex env entries (`CODEX_HOME`, `CODEX_API_KEY`, `CODEX_MODEL`, `CODEX_BASE_URL`, `SKILLS_ROOT`) to `src/server/env/index.ts` (or equivalent env schema module) with Zod validation that fails soft (returns `available: false`) when required vars are missing
- [x] T011 Implement `src/features/agents/codex/runtime/codex-config.server.ts` to write `$CODEX_HOME/config.toml` on startup using `env_key` references (no literal secrets) and to delete the file on graceful shutdown
- [x] T012 [P] Add `CODEX_FEATURE_AVAILABLE` boolean derived from env validation in `src/features/agents/codex/runtime/feature-flag.server.ts` and export a server function consumed by UI loaders
- [x] T013 [P] Define the product-safe SSE event union in `src/features/agents/ui/builder-events.ts` with milestones from FR-039 and the failure taxonomy from FR-028
- [x] T014 [P] Define the builder-run status enum and shared types in `src/features/agents/ui/builder-run-status.ts`

**Checkpoint**: Templates relocated, Codex SDK installed, module skeleton in place, feature-availability flag wired. No behavioral change yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema reset, neutral-infrastructure move, and shared modules (boundary, validation, retention, context, events) that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T015 Drizzle migration in `src/db/schema.ts` + new file under `src/db/migrations/`: drop `agent_runs` and any auxiliary tables tied to the legacy AI agent; create `builder_runs` with columns `id`, `projectId`, `userId`, `kind`, `status`, `failureCode`, `startedAt`, `completedAt`, `draftWorkspacePath`, `selectedInstructions json()`, `pendingInstructions json()`, `commerceValidationStatus`, `metadata json()`. Use Drizzle `json()` per Constitution IX
- [x] T016 Reset legacy project-state columns in `src/db/schema.ts` that the new builder schema replaces; preserve project identity, owner, slug, preview port allocation only
- [x] T017 [P] `git mv` neutral project lifecycle modules out of `src/features/ai-agent/projects/**` (or equivalent) into `src/features/projects/**` and update imports to `@/features/projects/...`
- [x] T018 [P] `git mv` neutral runtime/PM2/preview/port-allocation modules into `src/features/runtime/**` and update imports
- [x] T019 [P] `git mv` neutral generated-workspace I/O modules into `src/features/generated-projects/**` and update imports
- [x] T020 [P] Define blocked + allowed-with-audit lists in `src/features/agents/codex/boundary/protected-paths.ts` per FR-020
- [x] T021 Implement `src/features/agents/codex/boundary/path-guard.server.ts` that validates `(projectId, userId, draftWorkspacePath)` for every tool/event with a path
- [x] T022 Implement `src/features/agents/codex/boundary/symlink-check.server.ts` that scans the draft for symlinks pointing outside the draft and fails closed
- [x] T023 Implement `src/features/agents/codex/boundary/filesystem-audit.server.ts` taking before/after run + before-promote snapshots
- [x] T024 Implement `src/features/agents/codex/boundary/diff-gate.server.ts` that rejects any changed path outside the draft or matching the blocked list
- [x] T025 Implement `src/features/agents/codex/boundary/promotion-gate.server.ts` that re-verifies `(projectId, userId, draftWorkspacePath)` immediately before sync
- [x] T026 [P] Implement `src/features/agents/codex/validation/typecheck.server.ts` that spawns `pnpm run typecheck` inside the draft and returns a structured summary (no raw stderr to UI)
- [x] T027 [P] Implement `src/features/agents/codex/validation/build.server.ts` for `pnpm run build`
- [x] T028 [P] Implement `src/features/agents/codex/validation/pm2-status.server.ts` wrapping `pm2 jlist`
- [x] T029 Implement `src/features/agents/codex/validation/preview-health.server.ts` covering PM2 status, root URL 200, core hard-gate routes (`/`, `/products`, `/products/:sampleProductId`, `/cart`, `/checkout`), and optional-route soft-warning recording per FR-029/FR-030
- [x] T030 [P] Implement `src/features/agents/codex/validation/product-sample-parser.server.ts` using AST/static evaluator to extract product id and store-slug fallback per FR-031/FR-032/FR-033 and to enforce the picsum allowlist per FR-035
- [x] T031 Implement `src/features/agents/codex/retention/draft-retention.server.ts` with idempotent 12h GC keyed on `(runId, retainUntil)`, post-promote immediate cleanup, and a startup hook plus 30-min interval per FR-015
- [x] T032 Implement `src/features/agents/codex/context/instruction-loader.server.ts` that reads files from `templates/codex-builder/*`, computes `hash`, and emits `{name, source, version, hash, loaded}` metadata using the `<selected_instruction>` wrapper per FR-044
- [x] T033 Implement `src/features/agents/codex/context/project-summary.server.ts` for versioned summary read/write with auto-approve vs identity/commerce-impacting approval gating per FR-011
- [x] T034 Implement `src/features/agents/codex/context/context-builder.server.ts` assembling the FR-010 bundle (summary, manifest, prompt, locale, draft path, validation rules, protected paths, foundation instructions block)
- [x] T035 Implement `src/features/agents/codex/events/milestone-mapper.server.ts` translating Codex SDK events to product-safe milestones; redacts paths and never forwards raw events per FR-039/FR-040
- [x] T036 Implement `src/features/agents/codex/runtime/codex-thread.server.ts` thin wrapper around `@openai/codex-sdk` enforcing `cwd`, `sandbox: workspace-write`, fixed `roots`, no `add-dir`, and token-usage logging per FR-005/FR-006/FR-012
- [x] T037 [P] Unit test `tests/unit/agents/codex/boundary/path-guard.test.ts` with adversarial cases (relative escapes, mismatched projectId, mismatched userId)
- [x] T038 [P] Unit test `tests/unit/agents/codex/boundary/symlink-check.test.ts` covering symlinks pointing outside draft, dangling symlinks, nested symlink chains
- [x] T039 [P] Unit test `tests/unit/agents/codex/boundary/diff-gate.test.ts` covering writes outside draft, blocked-list paths, and allowed-with-audit paths
- [x] T040 [P] Unit test `tests/unit/agents/codex/boundary/promotion-gate.test.ts` for project/user mismatch and path drift
- [x] T041 [P] Unit test `tests/unit/agents/codex/validation/product-sample-parser.test.ts` covering shape validation, function-call rejection, picsum allowlist, fallback chain (id → entityId → defaultModel.productId)
- [x] T042 [P] Unit test `tests/unit/agents/codex/retention/draft-retention.test.ts` with cancelled / failed-validation / boundary / promoted lifecycles
- [x] T043 [P] Unit test `tests/unit/agents/codex/context/context-builder.test.ts` verifying `<selected_instruction>` wrapper format and locale handling
- [x] T044 [P] Unit test `tests/unit/agents/codex/events/milestone-mapper.test.ts` verifying redaction (no raw paths, no raw prompt) and milestone ordering
- [x] T045 [P] Unit test `tests/unit/agents/codex/validation/preview-health.test.ts` covering core-route hard gate, optional-route soft warn, manifest-driven URL list

**Checkpoint**: Schema reset complete, neutral infra moved, all shared boundary/validation/retention/context modules implemented and unit-tested. User story phases can now begin in parallel.

---

## Phase 3: User Story 1 — Init a new retail storefront (Priority: P1) 🎯 MVP

**Goal**: From an empty project, an init prompt produces a published storefront with the 5 core routes returning HTTP 200, via batched Codex turns sharing a single thread.

**Independent Test**: Submit one init prompt to a fresh project; observe milestones `loading_context → planning → creating_draft → building_pages → checking_preview → publishing → done` and verify `/`, `/products`, `/products/:sampleProductId`, `/cart`, `/checkout` return 200.

### Tests for User Story 1

- [x] T046 [P] [US1] Unit test `tests/unit/agents/codex/runtime/init-batch-planner.test.ts` covering foundation/data → page batches → polish ordering, 40-file/batch cap, blocked-path rejection-then-revise loop
- [x] T047 [P] [US1] Integration test `tests/integration/agents/codex/init-flow.test.ts` mocking `@openai/codex-sdk` to drive a multi-batch init through the full lifecycle to promotion

### Implementation for User Story 1

- [x] T048 [US1] Implement `src/features/agents/codex/runtime/init-batch-planner.server.ts` deriving the skeleton plan (foundation/data → pages from `templates/codex-builder/init/manifest.json` → polish), enforcing 40-file/batch cap (FR-023), and triggering a one-shot revise turn when the plan touches blocked paths (FR-024)
- [x] T049 [US1] Implement init-kind orchestration inside `src/features/agents/codex/runtime/builder-run.server.ts` that creates the draft workspace, opens one Codex thread, runs the planning turn, then runs each batch turn sequentially through `codex-thread.server.ts` (FR-013, FR-024)
- [x] T050 [US1] Wire `productsListSample` smoke check into the init promote path inside `src/features/agents/codex/runtime/builder-run.server.ts` so a parser failure forces `validation_failed` before promotion (FR-031, FR-032)
- [x] T051 [US1] Add API route handler `src/routes/api/projects/$projectId/builder-runs/index.ts` (`POST`) that creates an init builder run, persists the row, and returns the run id (FR-038)
- [x] T052 [US1] Add API route handler `src/routes/api/projects/$projectId/builder-runs/$runId.stream.ts` (`GET` SSE) that streams milestones from `milestone-mapper.server.ts` (FR-039)
- [x] T053 [US1] Update the project workspace UI under `src/routes/projects/$projectId/*` to consume `builder-events.ts` and render init progress against the milestone union
- [x] T054 [P] [US1] Add Vietnamese-primary + English-fallback i18n strings for init milestones, success summary, and `commerceValidationStatus: skipped` soft warning

**Checkpoint**: Init flow can produce a published storefront. SC-001 holds.

---

## Phase 4: User Story 2 — Small / direct content or UI update (Priority: P1)

**Goal**: Content/copy/sample-data and in-route UI tweaks promote without a planning turn and without `pnpm build`.

**Independent Test**: On a promoted project, send a copy-edit prompt; the run runs typecheck + preview health only and promotes within seconds.

### Tests for User Story 2

- [x] T055 [P] [US2] Integration test `tests/integration/agents/codex/small-update.test.ts` mocking `@openai/codex-sdk` to verify the skip-planning fast path, build skipped, 20-file diff cap rejection

### Implementation for User Story 2

- [x] T056 [US2] Implement update classifier `src/features/agents/codex/runtime/update-classifier.server.ts` that returns `small_update` / `new_route` / `unsupported` based on prompt + protected-path scan (FR-022, FR-024, FR-026)
- [x] T057 [US2] Wire the small-update fast path inside `src/features/agents/codex/runtime/builder-run.server.ts`: skip planning, run a single Codex turn, enforce the 20-file diff cap, and skip `build.server.ts` when `update-classifier` returns `small_update` (FR-022, FR-026)
- [x] T058 [US2] Add `POST` retry handler reuse in `src/routes/api/projects/$projectId/builder-runs/index.ts` so small-update prompts share the same endpoint with kind discrimination
- [x] T059 [US2] Surface small-update progress (no planning milestone) in the project UI under `src/routes/projects/$projectId/*`

**Checkpoint**: Small/direct updates promote on typecheck + preview health only. SC-002 holds.

---

## Phase 5: User Story 3 — Add a new route / page (Priority: P2)

**Goal**: New-route requests run a planning turn and a full build before promotion; preview health includes the new route.

**Independent Test**: Submit a prompt asking to add `/about`; observe planning milestone, full build, and preview health probing the new URL.

### Tests for User Story 3

- [x] T060 [P] [US3] Integration test `tests/integration/agents/codex/new-route.test.ts` mocking Codex to ensure planning turn runs, `pnpm build` runs, and the new route is added to the preview health URL list

### Implementation for User Story 3

- [x] T061 [US3] Extend `src/features/agents/codex/runtime/update-classifier.server.ts` to detect new-route requests (manifest delta / route file creation) and force a planning turn (FR-024)
- [x] T062 [US3] Wire the new-route path inside `src/features/agents/codex/runtime/builder-run.server.ts` to require planning + full build, and to forward the new route URL into `preview-health.server.ts` (FR-024, FR-025, FR-029)
- [x] T063 [US3] Update `src/features/agents/codex/validation/preview-health.server.ts` to accept a per-run extra-routes list derived from the diff
- [x] T064 [US3] Add new-route progress states in the project UI

**Checkpoint**: New-route flow runs planning + full build before promotion. SC-003 holds.

---

## Phase 6: User Story 4 — Validation failure with same-thread repair (Priority: P2)

**Goal**: Failing validation triggers up to 2 in-thread repair cycles; cycle 3 is impossible.

**Independent Test**: Inject a deliberate typecheck failure; observe cycle 1 then cycle 2 attempts; if both fail, run ends with `repair_exhausted` and is not promoted.

### Tests for User Story 4

- [x] T065 [P] [US4] Unit test `tests/unit/agents/codex/runtime/repair-loop.test.ts` covering 0/1/2 cycle outcomes and the `repair_exhausted` failure code
- [x] T066 [P] [US4] Integration test `tests/integration/agents/codex/repair-cycle.test.ts` with a failing-then-recovering Codex mock and a permanently-failing mock

### Implementation for User Story 4

- [x] T067 [US4] Implement `src/features/agents/codex/runtime/repair-loop.server.ts` that re-feeds the validation summary into the same Codex thread (no new thread), caps at 2 cycles, and emits the `repairing` milestone (FR-027, FR-028)
- [x] T068 [US4] Wire the repair loop into `src/features/agents/codex/runtime/builder-run.server.ts` between validate and promote
- [x] T069 [US4] Render `repairing` milestone and final `repair_exhausted` failure in the project UI

**Checkpoint**: Repair caps at 2 cycles. SC-004 holds.

---

## Phase 7: User Story 5 — Boundary violation fails closed (Priority: P1)

**Goal**: Any boundary signal (Codex tool error, sandbox denial, app filesystem audit, diff gate, promotion gate) fails the run with `boundary_violation`; no repair, no promote.

**Independent Test**: Use a fixture prompt that asks Codex to write outside draft (mocked); run ends with `boundary_violation`, no repair attempted, draft retained 12h with restricted access.

### Tests for User Story 5

- [x] T070 [P] [US5] Integration test `tests/integration/agents/codex/boundary-violation.test.ts` covering path traversal, symlink escape, and a diff-gate violation in three sub-cases
- [x] T071 [P] [US5] Unit test `tests/unit/agents/codex/runtime/violation-counter.test.ts` for project-level suspension threshold

### Implementation for User Story 5

- [x] T072 [US5] Implement `src/features/agents/codex/runtime/violation-counter.server.ts` that records boundary violations per project, applies suspension at threshold, and escalates per user/org (FR-018)
- [x] T073 [US5] Wire fail-closed handling in `src/features/agents/codex/runtime/builder-run.server.ts`: on any layer's boundary signal mark `BOUNDARY_VIOLATION`, skip repair/promote, route the draft into the restricted retention path, and surface only product-safe text (FR-017, FR-019)
- [x] T074 [US5] Extend `src/features/agents/codex/retention/draft-retention.server.ts` with a `restricted` retention flag for boundary drafts (FR-015)
- [x] T075 [US5] Surface `failed` + product-safe message (no path leakage) in the project UI

**Checkpoint**: Boundary violations always fail closed. SC-005 holds.

---

## Phase 8: User Story 6 — Cancellation (Priority: P2)

**Goal**: User cancel interrupts the active Codex turn, no promote happens, draft retained 12h, UI shows "no changes were published".

**Independent Test**: Start a run, cancel mid-`creating_draft`; verify the run becomes `cancelled` and the published workspace is unchanged.

### Tests for User Story 6

- [x] T076 [P] [US6] Integration test `tests/integration/agents/codex/cancel.test.ts` exercising cancel during planning, mutation, and validation phases
- [x] T077 [P] [US6] Unit test `tests/unit/agents/codex/runtime/cancel-controller.test.ts` for AbortController plumbing and idempotency

### Implementation for User Story 6

- [x] T078 [US6] Implement `src/features/agents/codex/runtime/cancel-controller.server.ts` exposing a per-run AbortController, propagating cancellation into `codex-thread.server.ts`, and ensuring idempotency (FR-048)
- [x] T079 [US6] Add API handler `src/routes/api/projects/$projectId/builder-runs/$runId.cancel.ts` (`POST`) that signals the controller and updates run status (FR-038)
- [x] T080 [US6] Wire cancel-driven cleanup in `src/features/agents/codex/runtime/builder-run.server.ts`: stop active turn, mark run `cancelled`, schedule 12h retention
- [x] T081 [US6] Add cancel button + cancelled-state messaging in the project UI

**Checkpoint**: Cancel works mid-run. SC-006 (retention side) confirmed.

---

## Phase 9: User Story 7 — Codex feature unavailable at startup (Priority: P3)

**Goal**: Missing/invalid Codex env disables the builder feature; the rest of the app runs; user sees the localized unavailable banner.

**Independent Test**: Boot the app with `CODEX_API_KEY` blank; verify builder UI shows the banner, prompt input is disabled, and non-builder pages load.

### Tests for User Story 7

- [x] T082 [P] [US7] Integration test `tests/integration/agents/codex/feature-unavailable.test.ts` booting the app with missing Codex env and asserting the loader exposes `available:false`, banner copy is rendered, and a `POST /builder-runs` returns `config_unavailable`

### Implementation for User Story 7

- [x] T083 [US7] Harden startup env validation flow inside `src/features/agents/codex/runtime/codex-config.server.ts` + `feature-flag.server.ts` to set `CODEX_FEATURE_AVAILABLE=false` without throwing on missing/invalid env (FR-007, FR-009)
- [x] T084 [US7] Add the unavailable banner component under `src/routes/projects/$projectId/*` (or shared layout) wired off `CODEX_FEATURE_AVAILABLE`, with disabled prompt input
- [x] T085 [US7] Add localized banner copy (Vietnamese primary, English fallback) — primary string: `Trinh tao AI hien tam thoi khong kha dung. Vui long lien he quan tri vien hoac thu lai sau.`
- [x] T086 [US7] Reject `POST /builder-runs` with `config_unavailable` when the feature flag is false in `src/routes/api/projects/$projectId/builder-runs/index.ts` (FR-028)

**Checkpoint**: Builder feature gracefully disables on missing env. SC-008 holds.

---

## Phase 10: User Story 8 — Concurrency rejection (Priority: P3)

**Goal**: One builder run per project at a time. New prompts during an active run are rejected with a friendly message; no queue.

**Independent Test**: Start a run, submit a second prompt to the same project; second `POST` returns a friendly error.

### Tests for User Story 8

- [x] T087 [P] [US8] Integration test `tests/integration/agents/codex/concurrency.test.ts` verifying second concurrent `POST` is rejected with a structured error and no second run is created

### Implementation for User Story 8

- [x] T088 [US8] Implement per-project active-run lock in `src/features/agents/codex/runtime/active-run-lock.server.ts` keyed on `projectId` (FR-041)
- [x] T089 [US8] Wire the lock into `src/routes/api/projects/$projectId/builder-runs/index.ts` so a duplicate `POST` returns `{ ok:false, code:'active_run_exists', message }` per Constitution III
- [x] T090 [US8] Add API handler `src/routes/api/projects/$projectId/builder-runs/$runId.retry.ts` (`POST`) that creates a fresh run only when no active run is held (FR-038)
- [x] T091 [US8] Surface concurrency rejection inline in the prompt input UI (not a toast) in `src/routes/projects/$projectId/*`

**Checkpoint**: Concurrency rule enforced. All user stories independently functional.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Delete the legacy AI Agent runtime, remove taste-skill artifacts, run the full quality gate, then execute the manual VPS smoke checklist.

**Deferral note (Phase 11 implementation)**: T092–T101 delete the legacy AI Agent runtime under `src/features/ai-agent/*`, the legacy `runs/` API, and several server services + the `agent_runs` schema. The legacy stack still has live consumers in `src/routes/projects/$projectId.tsx` (1409 lines), `src/routes/dashboard/index.tsx`, `src/routes/projects/index.tsx`, `src/routes/projects/starred.tsx`, and `src/components/projects/ProjectSettingsInfoTab.tsx`. None of those consumers are rewritten by T046–T091, so deleting the legacy stack now would force an out-of-phase UI rewrite. **Per the user's "Surgical — spec'd deletions + stubs" decision, T092–T101 are deferred to a dedicated follow-up PR** that pairs the deletions with a builder-runs UI cut-over. The new builder-runs stack (Phases 1–10) ships alongside the legacy stack in this branch; both run in parallel until the follow-up lands.

- [ ] T092 [ALL] Delete `src/features/ai-agent/agent`
- [ ] T093 [ALL] Delete `src/features/ai-agent/code-tools`
- [ ] T094 [ALL] Delete `src/features/ai-agent/openai`
- [ ] T095 [ALL] Delete `src/features/ai-agent/planning`
- [ ] T096 [ALL] Delete `src/features/ai-agent/runtime`
- [ ] T097 [ALL] Delete `src/features/ai-agent/store-runtime`
- [ ] T098 [ALL] Delete `src/features/ai-agent/thinking`
- [ ] T099 [ALL] Delete `src/features/ai-agent/taste-skill-loader.server.ts` and `taste-skill-preload.server.ts`
- [ ] T100 [ALL] Remove all references to `flags.tasteSkillLoaded`, `project_read_taste_skill`, and `.agents/skills/design-taste-frontend` from the codebase; grep-verify zero remaining importers
- [ ] T101 [ALL] Remove now-unused fields from project state schema if their last reader is gone (Drizzle migration)
- [x] T102 [ALL] Run `pnpm lint --fix` and resolve remaining issues
- [x] T103 [ALL] Run `pnpm typecheck` and resolve remaining issues
- [x] T104 [ALL] Run `pnpm test` and ensure all unit + integration tests pass
- [ ] T105 [ALL] Manual VPS smoke step 1: submit init prompt → verify 5 core routes 200 on the preview URL (SC-001)
- [ ] T106 [ALL] Manual VPS smoke step 2: submit small/copy update → verify typecheck-only, no build (SC-002)
- [ ] T107 [ALL] Manual VPS smoke step 3: submit new-route prompt → verify planning + build + preview health on new URL (SC-003)
- [ ] T108 [ALL] Manual VPS smoke step 4: drive a failing draft → 2 repair cycles → verify success or `repair_exhausted` (SC-004)
- [ ] T109 [ALL] Manual VPS smoke step 5: inject path traversal in fixture prompt → verify `boundary_violation` fail-closed and restricted retention (SC-005)
- [ ] T110 [ALL] Manual VPS smoke step 6: cancel mid-run → verify `cancelled`, draft retained 12h, published unchanged (SC-006 retention path)
- [ ] T111 [ALL] Manual VPS smoke step 7: blank `CODEX_API_KEY` → verify app starts, builder banner shown, non-builder pages load (SC-008)
- [x] T112 [ALL] Update `docs/deploy-vps.md` if any operational detail drifted during implementation; verify env table and verify-commands still match the runtime

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No prereq.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all user stories.
- **Phases 3–10 (User Stories)**: All depend on Phase 2. Within Phase 2 they can proceed in parallel by P1 first (US1 init MVP, US2 small update, US5 boundary), then P2 (US3 new route, US4 repair, US6 cancel), then P3 (US7 unavailable, US8 concurrency).
- **Phase 11 (Polish)**: Depends on all user-story phases that the team chose to ship.

### Within Each User Story

- Tests before implementation where the test is mandated.
- Foundational modules MUST exist (Phase 2) before story-specific orchestration imports them.
- Story-specific orchestration tasks in `builder-run.server.ts` are sequential (single file).
- API handler can land in parallel with UI updates only when both have the underlying lifecycle wired.

### Parallel Opportunities

- Phase 1: T009, T012, T013, T014 in parallel after T008 finishes.
- Phase 2: T017–T019 (`git mv` neutral infra) in parallel; T020, T026–T028, T030 in parallel; all unit tests T037–T045 in parallel after their target modules land.
- Phase 3+: integration tests (T047, T055, T060, T066, T070, T076, T082, T087) can run in parallel against fixtures even while implementations land.
- Polish T092–T099 deletions are file-isolated and can run together; T105–T111 manual smokes are independent runs.

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 → Phase 2 → Phase 3 (US1 init).
2. Manual smoke step 1 (T105) and step 5 (T109) for boundary safety baseline.
3. Hold US2–US8 until US1 is stable.

### Incremental Delivery

1. Foundation (Phase 1+2) → ready.
2. + US1 → MVP demo.
3. + US2 + US5 → covers high-frequency happy path + safety.
4. + US3 + US4 + US6 → full lifecycle robustness.
5. + US7 + US8 → degraded-mode + concurrency hardening.
6. Polish.

### Parallel Team Strategy (single-dev project — for reference)

Single-developer execution (per project memory). Run user-story phases sequentially but exploit `[P]` markers within each phase.

---

## Notes

- Phase 0 (spec, plan, grill sync, deploy doc) is already done — not in this task list.
- Skill runtime is deferred; only forward-compat extension points (`<selected_instruction>` wrapper, `selectedInstructions[] / pendingInstructions[]` schema fields, `SKILLS_ROOT` env reservation) are in scope.
- `git mv` is required for template migration to preserve history.
- No raw prompt / raw diff / full file content in any log or persisted metadata.
- Drizzle JSON columns use `json()`, not `jsonb()` (Constitution IX).
- All cross-folder imports use `@/` or `@app/` (Constitution X).
- Pre-production single-developer project (per memory): destructive schema/state resets are acceptable; no historical data migration.

---

## Coverage Map

| FR range | Task IDs |
| --- | --- |
| FR-001 module layout | T009 |
| FR-002 delete legacy runtime | T092–T099 |
| FR-003 templates migration | T001–T006 |
| FR-004 context builder reads codex-builder | T032, T034 |
| FR-005 in-process Codex SDK | T036 |
| FR-006 thread cwd/sandbox/roots | T036, T049 |
| FR-007 startup env validation | T010, T083 |
| FR-008 CODEX_HOME profile generation | T011 |
| FR-009 no silent fallback | T010, T083 |
| FR-010 context bundle | T034 |
| FR-011 versioned project summary | T033 |
| FR-012 token usage logged only | T036 |
| FR-013 per-run draft workspace | T049 |
| FR-014 promotion only after gates | T025, T049, T050 |
| FR-015 retention rules | T031, T074 |
| FR-016 multi-layer boundary | T021–T025 |
| FR-017 boundary fail-closed | T073 |
| FR-018 repeated-violation suspension | T072 |
| FR-019 logs no path/content leakage | T035, T073 |
| FR-020 protected-path lists | T020 |
| FR-021 blocked path no Codex call | T056, T057 |
| FR-022 20-file diff cap | T024, T057 |
| FR-023 40-file/batch init cap | T048 |
| FR-024 planning turn rules | T048, T056, T061 |
| FR-025 validation gates | T026–T029 |
| FR-026 small-update skip build | T057 |
| FR-027 repair max 2 cycles | T067 |
| FR-028 failure taxonomy | T013, T067, T073, T086 |
| FR-029 preview health hard gate | T029 |
| FR-030 optional route soft warn | T029, T063 |
| FR-031 sample id derivation | T029, T030, T050 |
| FR-032 sample data shape | T030, T050 |
| FR-033 AST parser | T030 |
| FR-034 VITE_STORE_SLUG fallback | T030 |
| FR-035 picsum allowlist | T030 |
| FR-036 builder_runs schema | T015 |
| FR-037 drop agent_runs | T015 |
| FR-038 builder-runs API routes | T051, T052, T079, T090 |
| FR-039 product-safe milestones | T013, T035 |
| FR-040 metadata logs no raw content | T035, T049 |
| FR-041 1 active run/project | T088, T089 |
| FR-042 project state reset | T016, T101 |
| FR-043 lifecycle slot order | T034, T049 |
| FR-044 `<selected_instruction>` wrapper | T032, T034 |
| FR-045 pendingInstructions field | T015 |
| FR-046 no taste-skill BC alias | T099, T100 |
| FR-047 SKILLS_ROOT env reserved | T010 |
| FR-048 cancel mechanics | T078, T079, T080 |
