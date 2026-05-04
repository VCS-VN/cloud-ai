# Tasks: Builder Pages UI Refresh

**Input**: Design documents from `specs/003-update-builder-ui/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/ui-contract.md`, `quickstart.md`

**Tests**: No automated tests were explicitly requested for this UI refresh. Validation tasks use `pnpm lint`, `pnpm build`, and visual QA from `quickstart.md`.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Phase 1: Setup

**Purpose**: Establish current UI baseline and implementation guardrails.

- [X] T001 Review `DESIGN.md`, `specs/003-update-builder-ui/contracts/ui-contract.md`, and the two reference screenshots to capture compact builder UI rules before editing.
- [X] T002 Inspect current target implementation in `src/routes/index.tsx`, `src/routes/projects.tsx`, `src/components/home/HomePromptForm.tsx`, and `src/components/projects/`.
- [X] T003 [P] Run `pnpm lint` before implementation and record any pre-existing type issues separately from this feature.
- [X] T004 [P] Check current supported-width behavior for `/` and `/projects` at iPad landscape, laptop, and desktop widths using the existing app layout.

---

## Phase 2: Foundational Compact Builder UI

**Purpose**: Create shared visual primitives and sizing behavior that block all user stories.

- [X] T005 Define compact builder page/shell utility classes or reusable CSS patterns in `app/styles/globals.css` using existing `DESIGN.md` tokens.
- [X] T006 Add compact typography, panel, card, button, input, segmented-control, and sidebar sizing rules in `app/styles/globals.css` without globally shrinking unrelated DESIGN.md tokens.
- [X] T007 Update shared empty/loading/error state sizing in `src/components/common/EmptyState.tsx`, `src/components/common/LoadingState.tsx`, and `src/components/common/ErrorState.tsx` to use compact builder surfaces.
- [X] T008 [P] Audit overflow handling in shared text containers and form controls in `app/styles/globals.css` to protect long names, prompts, messages, and generated item labels.
- [X] T009 [P] Document implementation-specific visual QA checkpoints in `specs/003-update-builder-ui/quickstart.md` if the source file paths or validation commands differ from the plan.

**Checkpoint**: Compact UI foundation is ready; user-story work can begin.

---

## Phase 3: User Story 1 - Understand the AI Builder Entry Point (Priority: P1)

**Goal**: Home page feels friendly, minimal, and clearly explains building a website from a prompt.

**Independent Test**: Open `/` at iPad landscape, laptop, and desktop widths; confirm users can identify the AI website-builder purpose, prompt entry, primary action, and examples without horizontal overflow.

### Implementation for User Story 1

- [X] T010 [US1] Rewrite the home hero welcome text in `src/routes/index.tsx` to be friendly Vietnamese copy focused on building websites from ideas, not technical workspace/agent language.
- [X] T011 [US1] Restructure the home layout in `src/routes/index.tsx` into a minimal builder landing surface with centered prompt flow and compact supporting guidance.
- [X] T012 [US1] Add plain-language prompt examples or guidance blocks in `src/routes/index.tsx` using compact DESIGN.md-aligned styling.
- [X] T013 [US1] Reduce prompt composer visual scale in `src/components/home/HomePromptForm.tsx`, including textarea height, padding, actions, helper/error text, and submit state.
- [X] T014 [US1] Ensure home prompt long-text wrapping and loading/error feedback remain readable in `src/components/home/HomePromptForm.tsx`.
- [X] T015 [US1] Validate `/` visually from iPad landscape upward and adjust `src/routes/index.tsx` or `app/styles/globals.css` to remove overflow or oversized spacing.

**Checkpoint**: User Story 1 works independently and can be demonstrated as the MVP entry point.

---

## Phase 4: User Story 2 - Manage Projects From a Clean Projects Page (Priority: P1)

**Goal**: Projects page provides a left vertical menu and searchable right-side project list for user project management.

**Independent Test**: Open `/projects` with empty, single-project, multi-project, and no-search-result states; confirm sidebar navigation, search, project count, status, recency, and project selection are clear.

### Implementation for User Story 2

- [X] T016 [US2] Refactor the unselected/projects-management layout in `src/routes/projects.tsx` into a two-zone shell with a left vertical sidebar and right project list area.
- [X] T017 [US2] Add UI-only sidebar filter state in `src/routes/projects.tsx` for project navigation groups such as all projects, recent, starred, created by me, or shared.
- [X] T018 [US2] Add project search state and filtering in `src/routes/projects.tsx` matching project name and prompt/description without changing persisted data.
- [X] T019 [US2] Update `src/components/projects/ProjectList.tsx` to support searchable project list rendering, count display, empty state, and no-result state.
- [X] T020 [US2] Redesign `src/components/projects/ProjectListItem.tsx` as a compact row/card with clear name, summary, status, recency, and continue/select affordance.
- [X] T021 [US2] Add a compact create-first-project or start-new-project action from project empty states in `src/routes/projects.tsx` and `src/components/projects/ProjectList.tsx`.
- [X] T022 [US2] Validate project list long names/prompts and dense lists at iPad landscape and desktop widths; adjust `src/components/projects/ProjectListItem.tsx` and `app/styles/globals.css` as needed.

**Checkpoint**: User Story 2 works independently as a project-management page.

---

## Phase 5: User Story 3 - Work With Project Detail Clearly (Priority: P1)

**Goal**: Project detail clearly separates main Preview/Code output from the right-side chat panel.

**Independent Test**: Select a project from `/projects`; confirm project identity, status, Preview/Code switch, generated output area, right chat panel, composer, empty/loading states, and return-to-projects orientation are discoverable.

### Implementation for User Story 3

- [X] T023 [US3] Refactor selected-project detail composition in `src/routes/projects.tsx` into a main output area plus right-side chat panel.
- [X] T024 [US3] Add UI-only `preview`/`code` view mode state in `src/routes/projects.tsx` and render a compact top segmented switch above the main output area.
- [X] T025 [US3] Wire Preview mode in `src/routes/projects.tsx` to show project preview/detail content using existing `FilePreviewPanel` or equivalent generated content without adding backend behavior.
- [X] T026 [US3] Wire Code mode in `src/routes/projects.tsx` to show generated structure/code-oriented content using existing `ProjectFileExplorer`, `FilePreviewPanel`, or selected file data.
- [X] T027 [US3] Update `src/components/projects/ProjectMessagesPanel.tsx` and `src/components/projects/MessageBubble.tsx` for a compact right-side chat frame with long-message wrapping.
- [X] T028 [US3] Update `src/components/projects/MessageComposer.tsx` for compact right-panel usage with clear send/loading/error behavior.
- [X] T029 [US3] Keep selected project identity, status, recency, and primary next action visible in the project detail header in `src/routes/projects.tsx`.
- [X] T030 [US3] Validate switching Preview/Code does not clear selected project, selected node, chat history, or chat draft in `src/routes/projects.tsx`.
- [X] T031 [US3] Validate selected project detail at tablet and desktop widths; adjust stacking or panel widths in `src/routes/projects.tsx` and `app/styles/globals.css` to avoid cramped columns.

**Checkpoint**: User Story 3 works independently for selected project detail.

---

## Phase 6: User Story 4 - Experience Consistent Responsive Visual Design (Priority: P2)

**Goal**: Home, Projects, and Project Detail share consistent compact DESIGN.md-aligned visual language from iPad upward.

**Independent Test**: Navigate across `/` and `/projects` with and without a selected project at supported widths; confirm repeated buttons, inputs, cards, sidebars, panels, tabs, and state surfaces feel consistent and tidy.

### Implementation for User Story 4

- [X] T032 [US4] Normalize repeated action, panel, card, tab/switch, input, and sidebar class patterns across `src/routes/index.tsx` and `src/routes/projects.tsx`.
- [X] T033 [US4] Align `src/components/projects/ProjectFileExplorer.tsx`, `src/components/projects/ProjectFileTreeNode.tsx`, and `src/components/projects/FilePreviewPanel.tsx` with compact builder sizing.
- [X] T034 [US4] Remove or reduce oversized heading, padding, radius, and section spacing usage across `src/components/home/`, `src/components/projects/`, and `src/components/common/` where it conflicts with builder density.
- [X] T035 [US4] Verify no external brand assets or exact screenshot branding are copied into `src/routes/`, `src/components/`, or `app/styles/globals.css`.
- [X] T036 [US4] Perform responsive visual QA for `/`, `/projects`, and selected project detail at iPad landscape, laptop, and large desktop widths.

**Checkpoint**: All target pages share one coherent compact builder UI system.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup affecting multiple user stories.

- [X] T037 [P] Run `pnpm lint` and fix only issues introduced by this feature.
- [X] T038 [P] Run `pnpm build` and fix only build issues introduced by this feature.
- [X] T039 Review `specs/003-update-builder-ui/quickstart.md` and confirm each visual QA checklist item has been executed or documented.
- [X] T040 Check `src/routes/index.tsx`, `src/routes/projects.tsx`, and `src/components/` for unrelated business logic changes and revert any out-of-scope edits.
- [X] T041 Final review against `specs/003-update-builder-ui/contracts/ui-contract.md` to confirm Home, Projects, Project Detail, responsive, and visual contracts are satisfied.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories because compact visual primitives affect every page.
- **User Story 1 (Phase 3)**: Depends on Foundational; can ship as MVP home entry point.
- **User Story 2 (Phase 4)**: Depends on Foundational; can run in parallel with US1 after shared sizing exists.
- **User Story 3 (Phase 5)**: Depends on Foundational and benefits from US2 selection flow, but detail UI can be developed independently against an existing selected project state.
- **User Story 4 (Phase 6)**: Depends on desired P1 stories; provides cross-page consistency.
- **Polish (Phase 7)**: Depends on all desired stories for the release.

### User Story Dependencies

- **US1 (P1)**: Independent after Phase 2.
- **US2 (P1)**: Independent after Phase 2.
- **US3 (P1)**: Independent after Phase 2 using an existing selected project state; integrates naturally with US2 selection.
- **US4 (P2)**: Depends on the target pages/components being updated enough to normalize consistency.

### Parallel Opportunities

- T003 and T004 can run in parallel.
- T008 and T009 can run in parallel after T005-T007 are understood.
- US1 and US2 can be implemented in parallel after Phase 2 because they primarily touch different route sections/components.
- T025 and T026 can run in parallel after T024 if they are split across preview/code rendering responsibilities.
- T027 and T028 can run in parallel because message display and composer are separate files.
- T037 and T038 can run in parallel after implementation if the environment supports concurrent validation.

---

## Parallel Example: User Story 1

```bash
Task: "Update friendly home copy and route layout in src/routes/index.tsx"
Task: "Compact prompt composer sizing in src/components/home/HomePromptForm.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "Add sidebar filter and search state in src/routes/projects.tsx"
Task: "Redesign compact project rows in src/components/projects/ProjectListItem.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "Wire Preview/Code mode rendering in src/routes/projects.tsx"
Task: "Compact right-side chat display in src/components/projects/ProjectMessagesPanel.tsx and src/components/projects/MessageBubble.tsx"
Task: "Compact right-side composer in src/components/projects/MessageComposer.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational compact UI rules.
3. Complete Phase 3: Home page builder entry point.
4. Stop and validate `/` independently at supported widths.

### Incremental Delivery

1. Setup + Foundational compact UI.
2. US1 Home refresh → validate independently.
3. US2 Projects management refresh → validate independently.
4. US3 Project detail refresh → validate independently.
5. US4 consistency pass → validate across all target pages.
6. Polish validation with lint, build, and visual QA.

### Parallel Team Strategy

1. One person completes Phase 2 shared sizing and state components.
2. After Phase 2:
   - Developer A: US1 Home route and prompt form.
   - Developer B: US2 Projects sidebar/search/list.
   - Developer C: US3 Preview/Code detail and right chat.
3. One final pass handles US4 consistency and Phase 7 validation.

## Notes

- `[P]` tasks can be performed in parallel because they touch different files or are independent checks.
- `[US#]` labels map each task to a user story for traceability.
- Avoid backend, storage, authentication, AI generation, or publishing changes unless a task explicitly calls for UI-only wiring.
- Keep `DESIGN.md` as source of truth while applying compact sizing locally to builder UI.
- Phone-sized mobile support is out of scope; do not add mobile-only navigation complexity.
