# Tasks: Init Settings Seed

**Input**: Design documents from `/specs/030-init-settings-seed/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: No new automated tests requested. Tasks use manual validation and existing validation gates.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add template directory and static seed content used by all user stories.

- [x] T001 Create settings template directory at `templates/codex-builder/init/settings/`
- [x] T002 [P] Create runtime package template at `templates/codex-builder/init/settings/package.json.md`
- [x] T003 [P] Create Vite config template with manual alias at `templates/codex-builder/init/settings/vite.config.ts.md`
- [x] T004 [P] Create TypeScript config template at `templates/codex-builder/init/settings/tsconfig.json.md`
- [x] T005 [P] Create Tailwind config template with CSS-variable tokens at `templates/codex-builder/init/settings/tailwind.config.ts.md`
- [x] T006 [P] Create PostCSS config template at `templates/codex-builder/init/settings/postcss.config.cjs.md`
- [x] T007 [P] Create router template at `templates/codex-builder/init/settings/src-router.tsx.md`
- [x] T008 [P] Create global stylesheet template with standard Tailwind directives and baseline tokens at `templates/codex-builder/init/settings/src-styles-app.css.md`
- [x] T009 [P] Create root route template with CSS import and minimal outlet shell at `templates/codex-builder/init/settings/src-routes-root.tsx.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add reusable seed/install runtime code that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T010 Create seed module skeleton and target lists in `src/features/agents/codex/runtime/init-settings-seed.server.ts`
- [x] T011 Implement Markdown frontmatter parser for seed templates in `src/features/agents/codex/runtime/init-settings-seed.server.ts`
- [x] T012 Implement safe target validation for exact target match, relative path, and traversal rejection in `src/features/agents/codex/runtime/init-settings-seed.server.ts`
- [x] T013 Implement runtime-owned setting seed policy missing-write/same-ok/different-conflict in `src/features/agents/codex/runtime/init-settings-seed.server.ts`
- [x] T014 Implement editable baseline seed policy missing-write/existing-leave in `src/features/agents/codex/runtime/init-settings-seed.server.ts`
- [x] T015 Implement `InitSettingsSeedError` with conflict, invalid-template, and write-failure codes in `src/features/agents/codex/runtime/init-settings-seed.server.ts`
- [x] T016 Implement dependency install skip check for `node_modules/` and `pnpm-lock.yaml` in `src/features/agents/codex/runtime/init-settings-seed.server.ts`
- [x] T017 Implement pnpm install runner using `pnpm install --frozen-lockfile=false` in `src/features/agents/codex/runtime/init-settings-seed.server.ts`

**Checkpoint**: Foundation ready — templates and runtime helpers exist but are not yet wired into init flow.

---

## Phase 3: User Story 1 - Initialize a preview-ready storefront (Priority: P1) 🎯 MVP

**Goal**: A new init run prepares settings, editable baselines, dependencies, lockfile baseline, and then lets Agent build a preview-ready storefront.

**Independent Test**: Start a new project init from an empty workspace and verify required settings, editable baselines, dependency install, Agent generation, build validation, and preview health complete without manual settings creation.

### Implementation for User Story 1

- [x] T018 [US1] Import seed/install helpers into `src/features/agents/codex/runtime/builder-run.server.ts`
- [x] T019 [US1] Call `seedInitSettingsFiles` immediately after `ensureProjectWorkspace` in `src/features/agents/codex/runtime/builder-run.server.ts`
- [x] T020 [US1] Call dependency install helper after seeding and before `listFiles` in `src/features/agents/codex/runtime/builder-run.server.ts`
- [x] T021 [US1] Ensure `listFiles`, `buildContextBundle`, `takeSnapshot`, and `createBoundedCodexThread` run only after seed and install in `src/features/agents/codex/runtime/builder-run.server.ts`
- [x] T022 [US1] Confirm runtime install-created `pnpm-lock.yaml` is included in baseline before snapshot in `src/features/agents/codex/runtime/builder-run.server.ts`
- [ ] T023 [US1] Manually validate fresh init flow using `specs/030-init-settings-seed/quickstart.md`

**Checkpoint**: User Story 1 should initialize a preview-ready storefront from empty workspace.

---

## Phase 4: User Story 2 - Protect runtime-owned settings during init (Priority: P2)

**Goal**: Runtime-owned settings remain deterministic and protected; conflicts fail before Agent execution.

**Independent Test**: Run init with missing, identical, and conflicting runtime-owned files; verify missing files seed, identical files pass, and conflicts fail before Agent execution with clear path details.

### Implementation for User Story 2

- [x] T024 [US2] Map conflicting runtime-owned setting errors to `blocked_request` failure in `src/features/agents/codex/runtime/builder-run.server.ts`
- [x] T025 [US2] Map invalid template, write, and install errors to setup/runtime failure in `src/features/agents/codex/runtime/builder-run.server.ts`
- [x] T026 [US2] Keep `src/features/agents/codex/boundary/protected-paths.ts` unchanged and verify runtime-owned settings remain blocked
- [x] T027 [US2] Verify no settings entries are added to `templates/codex-builder/init/manifest.json`
- [ ] T028 [US2] Manually validate conflicting runtime-owned setting behavior using `specs/030-init-settings-seed/quickstart.md`

**Checkpoint**: User Story 2 should prevent unsafe config overwrites and keep Agent blocked from runtime-owned settings.

---

## Phase 5: User Story 3 - Allow safe storefront theme customization (Priority: P3)

**Goal**: Agent can customize storefront theme and root layout through editable files while protected settings remain unchanged.

**Independent Test**: Run init with a selected design style and verify Agent can update global styling/root layout while runtime-owned settings and lockfile stay unchanged after snapshot.

### Implementation for User Story 3

- [x] T029 [US3] Update runtime ownership and editable-file guidance in `templates/codex-builder/init/init-mode.md`
- [x] T030 [US3] Add guidance that theme variants and UI tokens belong in `src/styles/app.css` in `templates/codex-builder/init/init-mode.md`
- [x] T031 [US3] Add guidance that `src/routes/__root.tsx` may be edited for providers/header/footer/layout while preserving CSS import in `templates/codex-builder/init/init-mode.md`
- [x] T032 [US3] Add guidance not to create `src/main.tsx`, `src/client.tsx`, or `src/server.tsx` unless runtime instructions explicitly request them in `templates/codex-builder/init/init-mode.md`
- [ ] T033 [US3] Manually validate editable baseline preservation on retry/resume using `specs/030-init-settings-seed/quickstart.md`

**Checkpoint**: User Story 3 should let Agent style and wire layout safely without touching protected settings.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final checks and documentation alignment.

- [x] T034 [P] Review seeded dependency allowlist consistency with `templates/codex-builder/init/data/packages.md`
- [x] T035 [P] Verify generated template contents are minimal and exclude PWA, testing, database, deployment, AI-provider, and backend-only dependencies in `templates/codex-builder/init/settings/package.json.md`
- [x] T036 [P] Verify seeded config uses alias support for `@/` imports in `templates/codex-builder/init/settings/vite.config.ts.md` and `templates/codex-builder/init/settings/tsconfig.json.md`
- [x] T037 Run existing typecheck/build validation command for the repository from `package.json`
- [ ] T038 Run manual quickstart validation from `specs/030-init-settings-seed/quickstart.md`
- [ ] T039 Update implementation notes in `specs/030-init-settings-seed/quickstart.md` if manual validation reveals operator-facing steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion — MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational completion; can run after or alongside US1 wiring once shared files are coordinated.
- **User Story 3 (Phase 5)**: Depends on Setup and Foundational completion; can run in parallel with US2 after init-mode ownership decisions are stable.
- **Polish (Phase 6)**: Depends on desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Requires Setup + Foundational; no dependency on US2 or US3.
- **US2 (P2)**: Requires Setup + Foundational; uses same builder-run integration points as US1, so coordinate edits to `builder-run.server.ts`.
- **US3 (P3)**: Requires Setup + Foundational; independent from US1/US2 code wiring except final behavior validation.

### Within Each User Story

- Templates before seed module target lists.
- Seed parser/validation before seed policy.
- Seed/install helpers before builder-run integration.
- Builder-run integration before manual quickstart validation.
- Init prompt updates before theme/layout customization validation.

### Parallel Opportunities

- T002–T009 can run in parallel after T001.
- T034–T036 can run in parallel during polish.
- US3 prompt updates can be drafted while US1/US2 builder-run wiring is implemented, after target files are fixed.

---

## Parallel Example: User Story 1

```bash
Task: "Import seed/install helpers into src/features/agents/codex/runtime/builder-run.server.ts"
Task: "Call seedInitSettingsFiles immediately after ensureProjectWorkspace in src/features/agents/codex/runtime/builder-run.server.ts"
Task: "Call dependency install helper after seeding and before listFiles in src/features/agents/codex/runtime/builder-run.server.ts"
```

Note: These edit the same file, so they should be sequenced by one implementer, not parallelized.

## Parallel Example: Template Setup

```bash
Task: "Create package template at templates/codex-builder/init/settings/package.json.md"
Task: "Create Vite config template at templates/codex-builder/init/settings/vite.config.ts.md"
Task: "Create Tailwind config template at templates/codex-builder/init/settings/tailwind.config.ts.md"
Task: "Create global stylesheet template at templates/codex-builder/init/settings/src-styles-app.css.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup templates.
2. Complete Phase 2: Seed/install runtime helpers.
3. Complete Phase 3: Wire seed/install before Agent execution.
4. Stop and validate fresh init from an empty workspace.

### Incremental Delivery

1. Setup + Foundational → seed helpers available.
2. US1 → preview-ready init baseline.
3. US2 → conflict handling and protected-setting safety.
4. US3 → safe theme/root customization guidance.
5. Polish → dependency/package guidance consistency and manual validation.

### Parallel Team Strategy

With multiple developers:

1. Developer A creates static templates T002–T009.
2. Developer B implements seed parser/validation T010–T015 after templates are named.
3. Developer C drafts init-mode guidance T029–T032 after target paths are final.
4. One developer owns `builder-run.server.ts` wiring T018–T025 to avoid merge conflicts.

---

## Notes

- [P] tasks use different files and can run in parallel.
- No automated test tasks included because user explicitly selected no new tests.
- Keep `protected-paths.ts` unchanged unless implementation reveals an existing rule mismatch.
- Do not add settings files to `templates/codex-builder/init/manifest.json` or init batch planning.
- Stop at each checkpoint to validate the user story independently.
