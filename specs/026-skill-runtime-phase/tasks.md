# Tasks: Generic Skill Runtime (Phase 2)

**Input**: Design documents from `/specs/026-skill-runtime-phase/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required (Constitution Principle II) for: registry boot resilience (FR-003, FR-007), frontmatter parser (FR-002), template scanner (FR-008), deterministic detector (FR-010, FR-011, FR-012, FR-016), tie-break dispatch (FR-013, FR-014, FR-015), clarification flow (FR-017–FR-023), `<selected_skill>` wrapper format (FR-024–FR-026), `project_read_skill` tool boundary (FR-027–FR-031), required-skill missing fail-fast (FR-032). Other tests are optional.

**Organization**: Tasks grouped by user story (US1–US5) for independent implementation. Foundational phase (T009–T024) blocks all stories.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Different file, no dependency on another in-flight task in the same phase.
- **[Story]**: `[US1]`–`[US5]` for user-story phase tasks; absent for Setup, Foundational, Polish.
- File paths are absolute relative to repo root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the new module tree under `src/features/agents/codex/skills/*`, wire `SKILLS_ROOT` into the consumed env (Phase 1 only reserved it), and pre-create the test directories. No behavioral change yet.

- [x] T001 Create the new module skeleton folders + `index.ts` barrel under `src/features/agents/codex/skills/` (empty `export {}` barrels for now)
- [x] T002 Create test directories `tests/unit/agents/codex/skills/` and `tests/integration/agents/codex/`
- [x] T003 [P] Promote `SKILLS_ROOT` from reservation to consumption inside `src/server/env/codex.ts` so it returns the resolved path on `available: true`; default `process.cwd()/skills` (dev), `/var/bin/skills` (prod)
- [x] T004 [P] Define `MAX_SKILL_CHARS`, `LLM_TIE_BREAK_GAP`, `MAX_SELECTED_SKILLS` env entries (with defaults `32000`, `10`, `3`) in `src/server/env/codex.ts` Zod schema
- [x] T005 [P] Add `BuilderRunMilestone = "awaiting_clarification"` to `src/features/agents/ui/builder-events.ts` and `src/features/agents/ui/builder-run-status.ts`
- [x] T006 [P] Add `BuilderRunFailureCode = "required_skill_unavailable" | "skill_unavailable"` to `src/features/agents/ui/builder-events.ts`
- [x] T007 [P] Add Vietnamese-primary + English-fallback strings for the new milestone, the two new failure codes, the clarification question scaffold, and the `not_paused` / `empty_answer` / `invalid_option` API errors to `src/features/agents/ui/builder-run-i18n.ts`
- [x] T008 [P] Add `BuilderRunMilestone` mapping for `awaiting_clarification` in `src/features/agents/codex/events/milestone-mapper.server.ts` so existing translations from raw events still work

**Checkpoint**: Skeleton in place, env consumed, milestone enum extended. No behavioral change yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema migration, registry, parser, scanner — every user-story phase depends on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T009 Drizzle schema delta: add `selectedSkills json()`, `pendingSkills json()`, `loadedSkills json()` (defaults `[]`) to `src/db/schema/builder-runs.schema.ts`. Run `pnpm db:generate` to produce a new migration file under `src/db/migrations/`. Constitution IX: `json()` not `jsonb()`
- [x] T010 Update the `builder_runs` repository write path to populate the three new columns on insert/update (search for the existing `builder_runs` write site; one location)
- [x] T011 [P] Implement `src/features/agents/codex/skills/frontmatter-parser.ts` with strict Zod schema (`name`, `description`, `aliases[]`, `triggers[]`, `asksClarification`, `clarificationPolicy: "never" | "when_ambiguous" | "always_before_apply"`, `appliesTo[]`). Reject unknown values; strip frontmatter; return `{ meta, body }`
- [x] T012 [P] Implement `src/features/agents/codex/skills/skill-loader.server.ts` that takes a directory path, reads `<dir>/SKILL.md`, calls the parser, truncates the body at `MAX_SKILL_CHARS` with marker `\n\n... [truncated by skill loader] ...`, computes SHA-256 hash over the post-truncation body, and returns `{ meta, body, hash, truncated, version }`
- [x] T013 Implement `src/features/agents/codex/skills/registry.server.ts` with boot-time scan of `$SKILLS_ROOT/*/SKILL.md`. Skip on parse failures, name mismatch with directory, duplicate `name`, symlink escapes (use the Phase 1 `scanDraftForSymlinks` approach adapted to a single-level scan). Emit audit events `skill_registry_loaded` (with count) and `skill_load_failed` (per failure with reason). Expose `getSkill(name)`, `listSkills()`, `getRegistryStatus()`, plus `resetRegistryForTest()` for the test suite
- [x] T014 [P] Implement `src/features/agents/codex/skills/template-scanner.server.ts` that scans only the four active template families (`templates/codex-builder/foundation/edit-system.md`, `templates/codex-builder/init/system.md`, `templates/codex-builder/recovery/*.md`, `templates/codex-builder/redesign/*.md`). Picks up frontmatter `requiredSkills` / `recommendedSkills` and inline `^@skill:<name>\s+(required|recommended)\s*$` directives. Frontmatter takes precedence on conflict. Returns `TemplateScanResult[]` per data-model.md
- [x] T015 [P] Unit test `tests/unit/agents/codex/skills/frontmatter-parser.test.ts` covering valid inputs, missing required field, unknown `clarificationPolicy`, non-array `aliases/triggers/appliesTo`, name-pattern violation, frontmatter strip correctness
- [x] T016 [P] Unit test `tests/unit/agents/codex/skills/skill-loader.test.ts` covering normal load, truncation marker insertion + hash over truncated body, missing `SKILL.md`, malformed YAML, name/dir mismatch
- [x] T017 [P] Unit test `tests/unit/agents/codex/skills/registry.test.ts` covering registry boot with one valid + two invalid skills, duplicate-name rejection, symlink escape rejection, empty `$SKILLS_ROOT` (registry empty, not error), `getSkill` hit/miss
- [x] T018 [P] Unit test `tests/unit/agents/codex/skills/template-scanner.test.ts` covering frontmatter-only declarations, inline-only directives, mixed directives with frontmatter precedence, missing template file resilience, non-active templates being ignored
- [x] T019 Implement `src/features/agents/codex/skills/detector.server.ts`: deterministic scoring matrix (template required +100, alias/explicit +80, template recommended +60, exact trigger +25, description keyword cluster +15, appliesTo +10), thresholds (>=80 auto / 50–79 candidate / 30–49 metadata-only / <30 ignore), cap at `MAX_SELECTED_SKILLS` with required-overrides-cap. Returns `DetectorOutcome` per data-model.md including per-source score breakdown
- [x] T020 Implement `src/features/agents/codex/skills/tie-break.server.ts` that takes a list of candidates + the prompt, calls the existing `Codex` SDK provider with structured output schema `{ pick: string | null, confidence: number, reason: string }`, sends only metadata (no SKILL.md body), bounded prompt ≤ 1k input tokens. Returns `{ pick, ambiguous, error? }`. Network/parse error → `error: "<message>"`
- [x] T021 Implement `src/features/agents/codex/skills/selection.server.ts` orchestrator: deterministic detector → if top-2 candidates in 50–79 band with gap ≤ `LLM_TIE_BREAK_GAP`, call `tie-break.server.ts` → if tie-break errors or returns ambiguous, escalate to clarification → emit `DetectorOutcome` with `picked[]`, `pending[]`, `tieBreakInvoked`, `clarificationRequired` flags
- [x] T022 [P] Unit test `tests/unit/agents/codex/skills/detector.test.ts` table-driven across the scoring matrix and threshold bands; verify `MAX_SELECTED_SKILLS` cap; verify required-overrides-cap; verify explicit-mention bump (+80) regardless of base detection
- [x] T023 [P] Unit test `tests/unit/agents/codex/skills/tie-break.test.ts` mocking the `Codex` SDK; covers confident pick, ambiguous response, network/timeout error, schema-mismatch response. Verify metadata-only payload (no body fields)
- [x] T024 [P] Unit test `tests/unit/agents/codex/skills/selection.test.ts` orchestrator routing: clear-pick → no tie-break, no clarification; tight ambiguity + tie-break confident → no clarification; tight ambiguity + tie-break ambiguous → clarification escalation; LLM error → clarification escalation; `clarificationPolicy: always_before_apply` → clarification regardless of score; `clarificationPolicy: never` + true tie → first-by-deterministic-order

**Checkpoint**: Schema delta applied. Registry boots. Parser, scanner, detector, tie-break, selection orchestrator implemented + unit-tested. User-story phases can now begin.

---

## Phase 3: User Story 1 — Skill auto-applied to an init run (Priority: P1) 🎯 MVP

**Goal**: When the active init template declares `requiredSkills: [design-taste-frontend]` and the skill is in the registry, the detector picks the skill automatically (no clarification), the Codex context bundle includes a `<selected_skill>` block, and the run records the skill in `selectedSkills[]`.

**Independent Test**: From an empty project, submit one init prompt. Observe the SSE stream goes straight `loading_context → planning → creating_draft → ...`, never through `awaiting_clarification`. Verify the run's persisted `selectedSkills` contains `design-taste-frontend` with `source: "template_required"` and a hash matching the on-disk file.

### Tests for User Story 1

- [x] T025 [P] [US1] Unit test `tests/unit/agents/codex/skills/injection.test.ts` covering `<selected_skill>` wrapper format (all 5 attributes), ordering rules per `contracts/selected-skill-wrapper.md` (required first, explicit_user, then by descending score), audit hash invariant (block hash equals `selectedSkills[].hash`), no-op when `selectedSkills[]` is empty
- [x] T026 [P] [US1] Integration test `tests/integration/agents/codex/skill-init-injection.test.ts` mocking `@openai/codex-sdk` and the registry. Drive a small init run with `requiredSkills: [design-taste-frontend]` declared in the active template. Assert: no `awaiting_clarification` milestone, `selectedSkills` populated with the skill, hash matches the registered skill body

### Implementation for User Story 1

- [x] T027 [US1] Implement `src/features/agents/codex/skills/injection.server.ts` with `wrapSelectedSkill({ meta, content, source, score })` returning the formatted block, plus `buildSelectedSkillBlocks(selected: SelectedSkill[])` that emits in deterministic order per `contracts/selected-skill-wrapper.md`
- [x] T028 [US1] Extend `src/features/agents/codex/context/context-builder.server.ts` to accept `selectedSkills` input, call `buildSelectedSkillBlocks`, and concatenate the `<selected_skill>` blocks into the bundle right after the `<selected_instruction>` blocks. Phase 1 callers that pass no skills MUST keep working unchanged
- [x] T029 [US1] Extend `src/features/agents/codex/runtime/builder-run.server.ts` to call the selection orchestrator BEFORE creating the draft workspace. On `picked[]` (no clarification), persist `selectedSkills[]` to the in-memory handle, pass them to `buildContextBundle`, then continue into `creating_draft`. (Sequential — single file, single writer)
- [x] T030 [US1] Provision the seed skill at `skills/design-taste-frontend/SKILL.md`. Frontmatter: `name: design-taste-frontend`, `aliases: [taste skill, anti-slop]`, `triggers: [redesign, premium UI, storefront UI]`, `asksClarification: true`, `clarificationPolicy: when_ambiguous`, `appliesTo: [init_project, design_update, ui_mutation]`, `version: 1.0.0`. Body: port the existing design-taste content from Phase 1 foundation templates, stripping any duplication
- [x] T031 [US1] Update `templates/codex-builder/init/system.md` frontmatter to add `requiredSkills: [design-taste-frontend]` so every init run picks up the skill via the template scanner

**Checkpoint**: Init runs auto-apply the seed skill, SC-001 holds. MVP shippable.

---

## Phase 4: User Story 2 — Clarification when two skills tie (Priority: P1)

**Goal**: When two candidates score in 50–79 with gap ≤ 10 and the LLM tie-break also returns ambiguous, the run pauses with `awaiting_clarification`, persists `pendingSkills[]`, emits a single product-safe SSE question, and DOES NOT create a draft. On user answer, detector reruns and the run resumes.

**Independent Test**: Provision two skills with overlapping triggers in `$SKILLS_ROOT`. Submit a prompt that triggers both. Stub the LLM tie-break to return ambiguous. Assert: SSE emits `awaiting_clarification`, no draft directory exists on disk, `pendingSkills[]` is persisted. POST `/answer`. Assert: run resumes, draft is created, the answered skill ends up in `selectedSkills[]`.

### Tests for User Story 2

- [x] T032 [P] [US2] Integration test `tests/integration/agents/codex/skill-clarification-flow.test.ts` covering: tie → paused → no draft on disk → answer → detector rerun → draft created at this point → injected. Use stubbed tie-break returning `{ ambiguous: true }`
- [x] T033 [P] [US2] Integration test `tests/integration/agents/codex/skill-clarification-cancel.test.ts` covering: paused → cancel → run terminates with `cancelled`, `pendingSkills[]` retained for audit, no draft on disk

### Implementation for User Story 2

- [x] T034 [US2] Implement `src/features/agents/codex/skills/clarification.server.ts` with `buildClarificationPrompt(candidates: PendingSkill[])` returning `{ question: string, options: { id: string, label: string }[] }`. Question is product-safe Vietnamese-primary; options use skill `name` as id and a human label derived from `description`. Cap at 4 options + free-text fallback
- [x] T035 [US2] Extend `src/features/agents/codex/runtime/builder-run.server.ts`: when selection returns `clarificationRequired`, persist `pendingSkills[]` to the in-memory handle + the `builder_runs` row metadata, emit a `awaiting_clarification` SSE event containing the clarification prompt + options, and return WITHOUT creating a draft. Pause flag on the handle so `cancelBuilderRun` still works. (Sequential — same file as T029)
- [x] T036 [US2] Add the `awaiting_clarification` event variant to `src/features/agents/ui/builder-events.ts` `BuilderRunEvent` discriminated union (carrying `question`, `options`, `runId`, `at`)
- [x] T037 [US2] Extend `src/features/agents/codex/runtime/builder-run-registry.server.ts` `publishBuilderRunEvent` to recognize the new event type and update handle status to `awaiting_clarification` (terminal=false, but skip default per-event handling)
- [x] T038 [US2] Implement `POST /api/projects/$projectId/builder-runs/$runId/answer` at `src/routes/api/projects/$projectId/builder-runs/$runId/answer.ts` per `contracts/answer-endpoint.md`. Validate: empty answer → `empty_answer`; not paused → `not_paused`; not owner → `forbidden`; runId not found → `not_found`. On success: rerun selection with `originalPrompt + answer + pendingSkills metadata`, replace `pendingSkills` with the rerun result, transition status, return `{ ok: true }`
- [x] T039 [US2] Extend `src/features/agents/ui/BuilderRunProgress.tsx` to render the clarification card: question, 3–4 option buttons, free-text textarea, submit button. On submit, POST `/answer`. Disable buttons during request. Show `empty_answer` / `invalid_option` errors inline using existing `inlineError` prop on `BuilderPromptInput`

**Checkpoint**: Clarification flow works end-to-end. SC-003 holds. Phase 1 cancel path still terminates a paused run cleanly.

---

## Phase 5: User Story 3 — Codex requests an additional skill mid-turn (Priority: P2)

**Goal**: A Codex turn can call `project_read_skill({ name })` to fetch a skill body from the registry. The tool resolves through the in-memory registry only, never escapes the boundary, returns structured errors on miss/traversal, and appends to `loadedSkills[]` audit on success.

**Independent Test**: Drive a Codex turn (mocked SDK) that calls `project_read_skill({ name: "design-taste-frontend" })`. Assert: tool returns the body, run's `loadedSkills[]` after the run includes the name (only). Drive an adversarial call with `name: "../../etc/passwd"`. Assert: structured error, no filesystem leak, audit log records `skill_load_failed`.

### Tests for User Story 3

- [x] T040 [P] [US3] Unit test `tests/unit/agents/codex/skills/project-read-skill.tool.test.ts` covering: happy path returns body; unknown name returns `not_found`; name with `/`, `\`, `..`, leading `/`, or absolute path returns `invalid_name`; empty registry returns `registry_unavailable`; success appends to `loadedSkills[]` (name + at) without body; multiple calls produce multiple entries (no de-dup)

### Implementation for User Story 3

- [x] T041 [US3] Implement `src/features/agents/codex/skills/project-read-skill.tool.server.ts` per `contracts/project-read-skill-tool.md`. Validate name regex `^[a-z][a-z0-9-]*$`. Lookup via `registry.getSkill(name)`. Return success or structured error (`not_found` / `invalid_name` / `registry_unavailable`). Surface a callback for the runtime to record `loadedSkills[]` entries
- [x] T042 [US3] Extend `src/features/agents/codex/runtime/codex-thread.server.ts` to register the `project_read_skill` tool through the SDK config layer. Accept the run handle so the tool's success callback can append to `loadedSkills[]` on the handle. (Sequential — single file)
- [x] T043 [US3] Extend the run finalize path in `src/features/agents/codex/runtime/builder-run.server.ts` to persist `loadedSkills[]` from the handle to the `builder_runs` row alongside `selectedSkills` / `pendingSkills`. (Sequential — same file as T029, T035)

**Checkpoint**: Codex can self-query skills. Tool boundary is sealed. SC-002 + SC-007 hold.

---

## Phase 6: User Story 4 — Required skill missing fails fast (Priority: P1)

**Goal**: If a `requiredSkills` entry from an active template is missing in the registry, the run aborts BEFORE any draft workspace is created or any Codex turn runs. Internal event `required_skill_unavailable`. User sees Vietnamese-primary "Không thể tiếp tục vì thiếu hướng dẫn bắt buộc cho agent."

**Independent Test**: Configure `$SKILLS_ROOT` so a referenced required skill is missing. Submit any prompt that activates the affected template. Assert: no draft on disk, no Codex thread started, run failed with code `required_skill_unavailable`, SSE emits the localized Vietnamese message.

### Tests for User Story 4

- [x] T044 [P] [US4] Integration test `tests/integration/agents/codex/skill-required-missing.test.ts` covering: required missing → fail-fast → no draft on disk → run.failureCode === "required_skill_unavailable" → SSE failed event message matches the Vietnamese-primary copy

### Implementation for User Story 4

- [x] T045 [US4] Extend the selection orchestrator in `src/features/agents/codex/skills/selection.server.ts` (or a new pre-check step) so that any `template_required` skill name not present in the registry yields `{ kind: "required_unavailable", missing: string[] }` and short-circuits before scoring. Recommended-skill missing logs a warning but does not block
- [x] T046 [US4] Extend `src/features/agents/codex/runtime/builder-run.server.ts` to handle the `required_unavailable` outcome: emit a `failed` event with `failureCode: "required_skill_unavailable"`, the localized message, and DO NOT create a draft. Audit log records `required_skill_unavailable` with the missing names. (Sequential — same file as previous US tasks)
- [x] T047 [US4] Extend the `POST /builder-runs/` API at `src/routes/api/projects/$projectId/builder-runs/index.ts` to reject explicit-user-mentioned missing skills BEFORE creating the run row, returning `{ ok: false, code: "skill_unavailable", message, missing: ["X"] }` per FR-034

**Checkpoint**: Required missing aborts cleanly with the right code + localized message. SC-004 holds.

---

## Phase 7: User Story 5 — Skill registry boots cleanly with malformed entries (Priority: P2)

**Goal**: On app startup with a broken skill (corrupt frontmatter, missing SKILL.md, symlink escape), the loader emits structured warnings, registers only the valid skills, and the app boots normally.

**Independent Test**: Drop a malformed `SKILL.md`, an empty subdirectory, and a symlinked subdirectory in a test `$SKILLS_ROOT`. Boot the registry. Assert: `skill_registry_loaded` count matches valid count; one `skill_load_failed` per invalid; non-builder endpoints respond normally; runs that don't depend on the broken skill succeed.

### Tests for User Story 5

- [x] T048 [P] [US5] Integration test `tests/integration/agents/codex/skill-registry-boot.test.ts` covering: 1 valid + 2 broken → boots cleanly; symlink escape rejected with `boundary_violation`-flavoured audit; empty `$SKILLS_ROOT` (zero skills) boots cleanly and runs without `requiredSkills` succeed

### Implementation for User Story 5

- [x] T049 [US5] Audit `src/features/agents/codex/skills/registry.server.ts` (added in T013) for the symlink-escape edge case explicitly: enumerate via `fs.readdir(root, { withFileTypes: true })`, reject `entry.isSymbolicLink()` early (do not resolve the link), record `skill_load_failed` reason `symlink_escape`. (Audit + small fix on the existing module from T013)

**Checkpoint**: Registry is resilient. SC-005 holds.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Wire the new event variant into the SSE serializer, run the full quality gate, and execute manual VPS smokes per `quickstart.md`.

- [x] T050 [ALL] Update `src/routes/api/projects/$projectId/builder-runs/$runId/stream.ts` SSE serializer to handle the new `awaiting_clarification` event variant (emit `event: awaiting_clarification\ndata: …` with the question + options payload)
- [x] T051 [ALL] Update `src/features/agents/ui/use-builder-run-stream.ts` to listen for the `awaiting_clarification` event type and update the `BuilderRunStreamState` with the question + options
- [x] T052 [ALL] Run `pnpm lint --fix` (project's lint = `tsc --noEmit`) and resolve remaining issues
- [x] T053 [ALL] Run `pnpm typecheck` and resolve remaining issues
- [x] T054 [ALL] Run `pnpm test` and ensure all unit + integration tests pass
- [ ] T055 [ALL] Manual VPS smoke step 1 (quickstart Step 1 + 2): seeded skill registers; init run injects it; `selectedSkills` populated with matching hash (SC-001)
- [ ] T056 [ALL] Manual VPS smoke step 2 (quickstart Step 4): rename seed skill aside; init run aborts with `required_skill_unavailable` and no draft on disk (SC-004)
- [ ] T057 [ALL] Manual VPS smoke step 3 (quickstart Step 5): provision a second overlapping skill; ambiguous prompt pauses with `awaiting_clarification`, no draft; POST `/answer` resumes; draft now exists; chosen skill in `selectedSkills` (SC-003)
- [ ] T058 [ALL] Manual VPS smoke step 4 (quickstart Step 7): adversarial `project_read_skill({ name: "../../etc/passwd" })` returns `invalid_name`, no leak (SC-007)
- [ ] T059 [ALL] Manual VPS smoke step 5 (quickstart Step 8): registry resilience with broken entry; valid skill still loads; non-builder endpoints unaffected (SC-005)
- [x] T060 [ALL] Verify SC-009 by running `git diff --stat 025-codex-sdk-migration..HEAD` and confirming zero changes under `src/routes/projects/$projectId.tsx`, `src/routes/dashboard/`, `src/routes/projects/index.tsx`, `src/routes/projects/starred.tsx`, `src/components/projects/ProjectSettingsInfoTab.tsx`, or any file under `src/features/ai-agent/*`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No prereq.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all user stories.
- **Phases 3–7 (User Stories)**: All depend on Phase 2. Within Phase 2 they can proceed in priority order: P1 first (US1 → US2 → US4 — three of the five user stories are P1), then P2 (US3, US5). US1 ships the MVP independently.
- **Phase 8 (Polish)**: Depends on all user-story phases that the team chose to ship.

### Within Each User Story

- Tests before implementation where the test is mandated.
- Foundational modules MUST exist (Phase 2) before story-specific orchestration imports them.
- Story-specific orchestration tasks in `builder-run.server.ts` are sequential (single file, multiple writers).
- API handler can land in parallel with UI updates only when both have the underlying lifecycle wired.

### Parallel Opportunities

- Phase 1: T003, T004, T005, T006, T007, T008 in parallel (skeleton + env entries + UI types in disjoint files).
- Phase 2: T011, T014 in parallel after T009/T010; T015–T018 + T022–T024 unit tests in parallel after their target modules land.
- Phase 3+: integration tests (T026, T032, T033, T044, T048) can run in parallel against fixtures even while implementations land.
- Polish T055–T059 manual smokes are independent runs.

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 → Phase 2 → Phase 3 (US1 init injection).
2. Manual smoke step 1 (T055) for the seeded skill baseline.
3. Hold US2–US5 until US1 is stable.

### Incremental Delivery

1. Foundation (Phase 1+2) → ready.
2. + US1 → MVP demo (every init run injects design-taste-frontend).
3. + US2 + US4 → covers ambiguity handling + required-missing fail-fast.
4. + US3 + US5 → adds Codex self-query + registry resilience.
5. Polish.

### Single-developer Strategy (per project memory)

Run user-story phases sequentially but exploit `[P]` markers within each phase. Detector + tie-break + selection in Phase 2 are the highest-leverage parallel block: 3 implementations + 3 unit tests can run as ≤ 4 sub-agents per wave per the implement-prompt rules.

---

## Notes

- `<selected_instruction>` (Phase 1) and `<selected_skill>` (Phase 2) coexist on the same context bundle. No rename, no deprecation in Phase 2.
- No raw SKILL.md body lands in DB or logs (audit hash + name only) per FR-038.
- Drizzle JSON columns use `json()`, not `jsonb()` (Constitution IX).
- All cross-folder imports use `@/` or `@app/` (Constitution X).
- Pre-production single-developer project (per memory): destructive schema changes are acceptable; the new columns default to `[]` so no data backfill needed.

---

## Coverage Map

| FR range | Task IDs |
| --- | --- |
| FR-001 boot scan | T013 |
| FR-002 frontmatter schema | T011 |
| FR-003 skip on parse failures | T013 |
| FR-004 duplicate-name handling | T013 |
| FR-005 truncation marker + hash | T012 |
| FR-006 no hot-reload | T013 (boot-only contract) |
| FR-007 empty `$SKILLS_ROOT` boots fine | T013, T048 |
| FR-008 active-template scanner | T014 |
| FR-009 missing-skill surfaces at run time | T045, T046 |
| FR-010 scoring matrix | T019, T022 |
| FR-011 thresholds | T019, T022 |
| FR-012 cap + required-overrides | T019, T022 |
| FR-013 tie-break trigger conditions | T020, T021, T024 |
| FR-014 LLM failure → user clarification | T020, T021, T024 |
| FR-015 ambiguous tie-break → user clarification | T020, T021, T024 |
| FR-016 explicit mention bump | T019, T022 |
| FR-017 pause before draft | T029, T035 |
| FR-018 persist `pendingSkills[]` | T035, T037 |
| FR-019 single SSE question | T035, T036, T050 |
| FR-020 POST /answer endpoint | T038 |
| FR-021 rerun semantics + score preservation | T038 |
| FR-022 cancel preserves audit | T033, T035 |
| FR-023 empty-answer rejection | T038 |
| FR-024 `<selected_skill>` wrapper | T025, T027 |
| FR-025 deterministic ordering | T025, T027 |
| FR-026 audit hash invariant | T025, T027 |
| FR-027 tool registration via registry | T041, T042 |
| FR-028 returns body on success | T040, T041 |
| FR-029 structured errors / no leak | T040, T041 |
| FR-030 audit `loadedSkills[]` append | T041, T042, T043 |
| FR-031 no extra filesystem access | T040, T041 |
| FR-032 required missing fail-fast | T044, T045, T046 |
| FR-033 recommended missing → continue | T045 |
| FR-034 explicit missing → API reject | T047 |
| FR-035 `selectedSkills` columns | T009, T010 |
| FR-036 `pendingSkills` column | T009, T010 |
| FR-037 `loadedSkills` column | T009, T010, T043 |
| FR-038 no raw body persisted | T010, T013, T041 |
| FR-039 audit events | T013, T021, T027, T041 |
| FR-040 answer is the only resume path | T038 |
| FR-041 SSE awaiting_clarification + new failure codes | T005, T006, T036, T050 |
| FR-042 Drizzle migration | T009 |
| FR-043 seed skill provisioned | T030 |
| FR-044 init template declares required | T031 |
| FR-045 `SKILLS_ROOT` consumed | T003 |
| FR-046 `MAX_SKILL_CHARS` / `LLM_TIE_BREAK_GAP` / `MAX_SELECTED_SKILLS` env | T004 |
| FR-047 reuse Codex provider for tie-break | T020 |
