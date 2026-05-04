# Tasks: AI Storefront UI

**Input**: Design documents from `specs/002-ai-storefront-ui/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/service-boundaries.md`, `quickstart.md`

**Execution Rule**: Complete exactly one task at a time, run its verification command(s), then stop for review of the diff before starting the next task.

**Scope Guardrails**:

- Do not modify `DESIGN.md`.
- Do not manually edit `routeTree.gen` or any generated route tree output.
- Do not integrate a real AI provider in this feature.
- Do not implement file CRUD create/rename/delete.
- Do not apply PWA setup to the builder dashboard; PWA belongs only to generated storefront output.
- Do not cache private API, user, or dynamic sensitive data in any service worker placeholder.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel only when files are independent and no unfinished task dependency exists.
- **[Story]**: User story label for story-phase tasks.
- Every task includes exact target files/modules and a verification command or explicit manual verification.

## Phase 1: Setup and Inspection (Shared Infrastructure)

**Purpose**: Confirm current repo conventions and prepare the TanStack Start/design-token foundation without implementing user flows.

- [X] T001 Inspect current repo conventions and document findings in `specs/002-ai-storefront-ui/implementation-notes.md`; read `package.json`, current route files, style setup, `DESIGN.md`, and relevant schema/service files. Verification: report findings only; no test command required.
- [X] T002 Configure TanStack Start dependencies and scripts in `package.json`, `vite.config.ts`, and related config files without implementing routes. Verification: `pnpm typecheck`.
- [X] T003 Create TanStack Start route foundation in `src/routes/__root.tsx` and move global style import to the TanStack Start shell; do not edit generated route tree files. Verification: `pnpm typecheck`.
- [X] T004 Map `DESIGN.md` tokens into `tailwind.config.ts` and `app/styles/globals.css` or the new global stylesheet path without changing `DESIGN.md`. Verification: `pnpm typecheck`.
- [X] T005 Create shared UI state components in `src/components/common/EmptyState.tsx`, `src/components/common/LoadingState.tsx`, and `src/components/common/ErrorState.tsx` using mapped design tokens. Verification: `pnpm typecheck`.

**Checkpoint**: TanStack Start foundation, token mapping, and shared states are ready for story work.

---

## Phase 2: Foundational Data and Server Boundaries (Blocking Prerequisites)

**Purpose**: Define small, replaceable data/service boundaries before UI routes consume them.

- [X] T006 Define UI-facing `Project`, `Message`, `ProjectFileNode`, `PwaConfig`, and `PwaIcon` types in `src/features/storefront-builder/types.ts`. Verification: `pnpm typecheck`.
- [X] T007 Add database schema for persisted project messages and virtual file nodes in `src/db/schema.ts` without removing existing storefront tables. Verification: `pnpm typecheck`.
- [X] T008 Extend project repository contracts for project listing, messages, and file nodes in `src/projects/repositories.ts`. Verification: `pnpm typecheck`.
- [X] T009 Implement database-backed message repository methods in `src/projects/repositories.ts` or `src/projects/message-repository.ts` behind the repository interface. Verification: `pnpm typecheck`.
- [X] T010 Implement database-backed file node repository methods in `src/projects/repositories.ts` or `src/projects/file-node-repository.ts` behind the repository interface. Verification: `pnpm typecheck`.
- [X] T011 Create `src/features/storefront-builder/mock-store.ts` only for deterministic seed/default generation helpers, not client-only persistence; include starter projects/messages for tests/dev if needed. Verification: `pnpm typecheck`.
- [X] T012 Implement project service boundary in `src/features/storefront-builder/project-service.ts` with `listProjects()` and `createProjectFromPrompt(prompt)`. Verification: `pnpm typecheck`.
- [X] T013 Implement message service boundary in `src/features/storefront-builder/message-service.ts` with `getProjectMessages(projectId)` and `sendProjectMessage(projectId, content)` including empty-message validation. Verification: `pnpm typecheck`.
- [X] T014 Implement file tree service boundary in `src/features/storefront-builder/file-tree-service.ts` with `getProjectFileTree(projectId)` and `getProjectFileNode(projectId, nodeId)`. Verification: `pnpm typecheck`.
- [X] T015 Create TanStack Start server functions in `src/server/functions/projects.ts` for project create/list/workspace loading using service boundaries. Verification: `pnpm typecheck`.
- [X] T016 Create TanStack Start server functions in `src/server/functions/project-messages.ts` for listing/sending messages using service boundaries. Verification: `pnpm typecheck`.
- [X] T017 Create TanStack Start server functions in `src/server/functions/project-files.ts` for loading file tree and selected file metadata. Verification: `pnpm typecheck`.

**Checkpoint**: UI can call server boundaries for project, message, and file data without coupling to storage details.

---

## Phase 3: User Story 1 - Start a Storefront From a Prompt (Priority: P1) 🎯 MVP

**Goal**: User can open Home, enter a prompt, submit it, see loading/error states, and navigate to `/projects` with the created project selected.

**Independent Test**: Open `/`, submit a valid long prompt, confirm loading appears, errors preserve input, and success navigates/selects the project in `/projects`.

### Implementation for User Story 1

- [X] T018 [P] [US1] Create `HomePromptForm` in `src/components/home/HomePromptForm.tsx` with greeting, placeholder, CTA, loading state, error state, and long-prompt-safe textarea. Verification: `pnpm typecheck`.
- [X] T019 [US1] Implement Home route composition in `src/routes/index.tsx` using `HomePromptForm` and project creation server function. Verification: `pnpm typecheck`.
- [X] T020 [US1] Add TanStack Router navigation after successful project creation in `src/routes/index.tsx` without using `window.location`. Verification: `pnpm typecheck`.
- [X] T021 [US1] Verify Home manually in dev server after adding `dev` script support in `package.json` if missing. Verification: `pnpm dev` and manual check that `/` renders Home.

**Checkpoint**: User Story 1 is independently functional and reviewable.

---

## Phase 4: User Story 2 - Browse and Select Projects (Priority: P1)

**Goal**: User can open `/projects`, see persisted projects, select one in a master-detail workspace, and see clear selected/empty states.

**Independent Test**: Open `/projects` with zero, one, and multiple projects; confirm empty state, selected state, and master-detail layout work.

### Implementation for User Story 2

- [X] T022 [P] [US2] Create `ProjectListItem` in `src/components/projects/ProjectListItem.tsx` showing name, description or initial prompt, status, updated time, and selected state. Verification: `pnpm typecheck`.
- [X] T023 [P] [US2] Create `ProjectList` in `src/components/projects/ProjectList.tsx` with loading, empty, error, and selection states. Verification: `pnpm typecheck`.
- [X] T024 [US2] Implement `/projects` route shell in `src/routes/projects.tsx` with master-detail state for selected project and project list loading. Verification: `pnpm typecheck`.
- [X] T025 [US2] Wire project selection in `src/routes/projects.tsx` so selecting a project updates workspace state without navigating to `/projects/$projectId`. Verification: `pnpm typecheck`.
- [X] T026 [US2] Verify Projects list manually in dev server. Verification: `pnpm dev` and manual check that `/projects` renders list, empty state, and selected state.

**Checkpoint**: User Story 2 is independently functional and reviewable.

---

## Phase 5: User Story 3 - Review and Continue Project Conversation (Priority: P1)

**Goal**: User can review chronological messages, distinguish user/agent messages, and send non-empty follow-up messages.

**Independent Test**: Select a project with messages, verify user/agent styling and labels, send a message, confirm empty input is blocked and successful send appends user and agent messages.

### Implementation for User Story 3

- [X] T027 [P] [US3] Create `MessageBubble` in `src/components/projects/MessageBubble.tsx` with distinct `Bạn` and `Agent` styles, safe text rendering, and long-content wrapping. Verification: `pnpm typecheck`.
- [X] T028 [P] [US3] Create `ProjectMessagesPanel` in `src/components/projects/ProjectMessagesPanel.tsx` with chronological rendering plus loading, empty, and error states. Verification: `pnpm typecheck`.
- [X] T029 [P] [US3] Create `MessageComposer` in `src/components/projects/MessageComposer.tsx` with empty-message blocking, disabled sending state, and clear-on-success behavior. Verification: `pnpm typecheck`.
- [X] T030 [US3] Wire `ProjectMessagesPanel` into `src/routes/projects.tsx` for selected project message loading. Verification: `pnpm typecheck`.
- [X] T031 [US3] Wire `MessageComposer` into `src/routes/projects.tsx` to call `sendProjectMessage`, append returned user/agent messages, and preserve draft on failure. Verification: `pnpm typecheck`.
- [X] T032 [US3] Verify messaging manually in dev server. Verification: `pnpm dev` and manual check user/agent labels, empty-message handling, loading/error behavior, and safe rendering.

**Checkpoint**: User Story 3 is independently functional and reviewable.

---

## Phase 6: User Story 4 - Explore Generated Storefront Structure (Priority: P2)

**Goal**: User can browse a virtual nested storefront file/folder tree, select files/folders, and see safe metadata or preview content.

**Independent Test**: Select a project with a virtual tree, confirm folders/files are visually distinct, nested structure renders, selected state appears, and file/folder metadata is shown without raw HTML rendering.

### Implementation for User Story 4

- [X] T033 [US4] Add per-project virtual file tree seed generation in `src/features/storefront-builder/mock-store.ts` or `src/features/storefront-builder/file-tree-service.ts` using the planned storefront structure; do not implement file CRUD. Verification: `pnpm typecheck`.
- [X] T034 [P] [US4] Create `ProjectFileTreeNode` in `src/components/projects/ProjectFileTreeNode.tsx` to render file/folder nodes recursively with icon/label/style differences and selected state. Verification: `pnpm typecheck`.
- [X] T035 [P] [US4] Create `ProjectFileExplorer` in `src/components/projects/ProjectFileExplorer.tsx` with tree rendering plus loading, empty, and error states. Verification: `pnpm typecheck`.
- [X] T036 [P] [US4] Create `FilePreviewPanel` in `src/components/projects/FilePreviewPanel.tsx` for file name, path, content type, updated time, safe text preview, folder metadata, and child count. Verification: `pnpm typecheck`.
- [X] T037 [US4] Wire file explorer selection state into `src/routes/projects.tsx` without mixing explorer logic into `ProjectMessagesPanel`. Verification: `pnpm typecheck`.
- [X] T038 [US4] Update `/projects` workspace layout in `src/routes/projects.tsx` to include project list, file explorer, file preview/metadata, message panel, and composer. Verification: `pnpm typecheck`.
- [X] T039 [US4] Verify explorer manually in dev server. Verification: `pnpm dev` and manual check nested tree, selected file/folder state, metadata preview, empty state, and no raw HTML rendering.

**Checkpoint**: User Story 4 is independently functional and reviewable.

---

## Phase 7: User Story 5 - Prepare Storefronts for Installable Output (Priority: P3)

**Goal**: Storefront project data includes PWA config and virtual/generated storefront output can include manifest/service-worker/icon artifacts when enabled, without affecting the builder dashboard.

**Independent Test**: Inspect a project with PWA enabled, confirm schema/config exists, manifest virtual file matches config, service worker placeholder avoids private data caching, and dashboard shell is unchanged.

### Implementation for User Story 5

- [X] T040 [US5] Add `PwaConfig` and `PwaIcon` to `src/storefront/types.ts` and `src/storefront/schema.ts` with validation for enabled config. Verification: `pnpm typecheck`.
- [X] T041 [US5] Add default PWA config derivation in `src/storefront/defaults.ts` or `src/features/storefront-builder/pwa-defaults.ts` from project/business/theme data. Verification: `pnpm typecheck`.
- [X] T042 [US5] Include PWA config in project creation in `src/features/storefront-builder/project-service.ts` without applying PWA behavior to the builder dashboard. Verification: `pnpm typecheck`.
- [X] T043 [US5] Add virtual PWA files to generated file tree in `src/features/storefront-builder/file-tree-service.ts`, including `manifest.webmanifest`, `service-worker.js`, and placeholder icon nodes. Verification: `pnpm typecheck`.
- [X] T044 [US5] Create `generatePwaManifest(project)` and `generateServiceWorker(project)` boundaries in `src/export/pwa-exporter.ts`; if full exporter integration is out of scope, keep them as typed interface/stub functions with safe outputs. Verification: `pnpm typecheck`.
- [X] T045 [US5] Ensure `service-worker.js` placeholder in `src/export/pwa-exporter.ts` or file tree content caches only app shell/static assets and explicitly avoids private API/user data. Verification: `pnpm typecheck`.
- [X] T046 [US5] Verify PWA manually in dev server or unit inspection. Verification: `pnpm dev` and manual check explorer shows PWA files, manifest preview matches `pwa.enabled` config, and builder dashboard has no PWA side effects.

**Checkpoint**: User Story 5 is independently functional and reviewable.

---

## Phase 8: Tests and Verification Coverage

**Purpose**: Add minimum automated coverage for service/component behavior once implementation slices exist.

- [X] T047 [P] Add service tests for project/message/file-tree/PWA defaults in `tests/unit/storefront-builder/storefront-builder-services.test.ts`. Verification: `pnpm test`.
- [X] T048 [P] Add component tests for Home prompt and project list states in `tests/unit/storefront-builder/home-and-project-list.test.tsx`. Verification: `pnpm test`.
- [X] T049 [P] Add component tests for message panel/composer empty-message handling in `tests/unit/storefront-builder/messages.test.tsx`. Verification: `pnpm test`.
- [X] T050 [P] Add component tests for explorer selected state and safe preview rendering in `tests/unit/storefront-builder/file-explorer.test.tsx`. Verification: `pnpm test`.
- [X] T051 Add route-level smoke test for `/` and `/projects` rendering in `tests/integration/storefront-builder-routes.test.tsx` if the configured test runner supports TanStack Start route rendering. Verification: `pnpm test`.

---

## Phase 9: Polish and Cross-Cutting Checks

**Purpose**: Verify DESIGN.md, responsive behavior, docs, and build commands after feature slices are complete.

- [X] T052 Audit Home, Projects, Explorer, Message Panel, and Composer styles against `DESIGN.md` tokens in `tailwind.config.ts`, global CSS, and component class usage; do not modify `DESIGN.md`. Verification: `pnpm lint` and manual visual report.
- [X] T053 Verify responsive behavior for Home and `/projects` workspace in component CSS/classes across `src/routes/index.tsx`, `src/routes/projects.tsx`, and project components. Verification: `pnpm dev` and manual mobile/tablet/desktop report.
- [X] T054 Run full type/lint/build verification and fix only feature-related issues in touched files. Verification: `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- [X] T055 Run test suite and fix only feature-related failures in touched files. Verification: `pnpm test`.
- [X] T056 Update `README.md` with dev command, TanStack Start route convention, mock/seed helper scope, database boundary notes, and PWA generated-storefront-only scope. Verification: manual documentation review.
- [X] T057 Update `specs/002-ai-storefront-ui/quickstart.md` with final verified commands and any route/setup notes discovered during implementation. Verification: manual documentation review.

---

## Dependencies and Ordering

### Phase Dependencies

- Phase 1 must complete before Phase 2.
- Phase 2 must complete before all user-story implementation phases.
- User Story 1 can be delivered first as MVP once Phase 2 is complete.
- User Story 2 depends on project listing boundaries from Phase 2.
- User Story 3 depends on selected project state from User Story 2 and message boundaries from Phase 2.
- User Story 4 depends on selected project state from User Story 2 and file tree boundaries from Phase 2.
- User Story 5 depends on types/schema from Phase 2 and can proceed after core project creation flow exists.
- Phase 8 tests should be added after corresponding implementation slices exist.
- Phase 9 polish runs after user stories are implemented.

### User Story Completion Order

1. US1 Start a Storefront From a Prompt.
2. US2 Browse and Select Projects.
3. US3 Review and Continue Project Conversation.
4. US4 Explore Generated Storefront Structure.
5. US5 Prepare Storefronts for Installable Output.

### Parallel Opportunities

- T005 can run after T004 if shared component token classes are clear.
- T009 and T010 can run in parallel after T008 if repository files are split.
- T018 can run after T005/T015 without waiting for route wiring.
- T022 and T023 can run in parallel after shared components exist.
- T027, T028, and T029 can run in parallel because they target separate message components.
- T034, T035, and T036 can run in parallel because they target separate explorer components.
- T047, T048, T049, and T050 can run in parallel after matching implementation slices exist.

## Implementation Strategy

### MVP First

Complete Phases 1-3 to prove TanStack Start foundation, DESIGN.md token mapping, server boundaries, and Home project creation flow.

### Incremental Delivery

After MVP, deliver one user story phase at a time and stop after each task for diff review:

1. Project listing and selection workspace.
2. Messages panel and composer.
3. File/folder explorer and safe preview.
4. PWA schema/virtual files/export boundaries.
5. Tests, responsive polish, and documentation.

### Review Checkpoints

Each task must stop after verification. The reviewer should check:

- Expected file/module scope only.
- Verification command output or manual report.
- No `DESIGN.md` edits.
- No manual route-tree edits.
- No real AI provider integration.
- No file CRUD beyond virtual tree display.
- No PWA effects on builder dashboard.
