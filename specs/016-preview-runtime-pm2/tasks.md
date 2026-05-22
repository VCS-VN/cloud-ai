# Tasks: Production Preview Runtime with Project Isolation

**Input**: Design documents from `/specs/016-preview-runtime-pm2/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`
**Tests**: Included because constitution requires tests for important business rules.

**Organization**: Tasks grouped by user story so each slice is independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: User story label for story phases only
- Every task includes exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add shared runtime configuration and dependencies without changing behavior.

- [X] T001 Add runtime dependencies (`pm2`, `http-proxy`, `jsonwebtoken` or chosen JWT library, and missing types) in `package.json`
- [X] T002 [P] Create project path helper with local and production defaults in `src/server/config/paths.server.ts`
- [X] T003 [P] Create preview runtime constants/env reader for port pool, public host, timeouts, memory limit, and Cloudflare env in `src/features/ai-agent/runtime/preview-runtime-config.server.ts`
- [X] T004 [P] Add unit tests for `getProjectsRoot()` local/prod/env behavior in `src/server/config/__tests__/paths.server.test.ts`
- [X] T005 Refactor workspace root default from `process.cwd()/projects` to `getProjectsRoot()` in `src/agent/project-workspace-service.ts`
- [X] T006 Refactor path guard root default from `process.cwd()/projects` to `getProjectsRoot()` in `src/features/ai-agent/security/path-guard.server.ts`
- [X] T007 Replace hardcoded `./projects/${input.projectId}` workspace roots with centralized workspace root resolution in `src/features/ai-agent/agent/agent-orchestrator.server.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core state model, drivers, and service registration required before any user story implementation.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T008 Extend `DevRuntime` schema fields for `enabled`, `previewHost`, `cloudflareDnsRecordId`, `dnsStatus`, `installStatus`, `lastAccessedAt`, and `operatorAttentionRequired` in `src/features/ai-agent/project/project-state.schema.ts`
- [X] T009 Update `EMPTY_DEV_RUNTIME` defaults and migration compatibility helpers in `src/features/ai-agent/project/project-state.schema.ts`
- [X] T010 Add typed dev runtime patch/read helpers for preview intent fields in `src/features/ai-agent/project/project-state-store.server.ts`
- [X] T011 [P] Add schema migration for additive preview intent defaults using PostgreSQL `json` in `src/db/migrations/0009_preview_intent.sql`
- [X] T012 [P] Implement pm2 API wrapper with connect/list/describe/start/stop/delete/restart methods in `src/features/ai-agent/runtime/pm2-driver.server.ts`
- [X] T013 [P] Implement pm2 driver tests with mocked pm2 API in `src/features/ai-agent/runtime/__tests__/pm2-driver.server.test.ts`
- [X] T014 [P] Implement port allocator for pool 10000-19999 with socket availability checks in `src/features/ai-agent/runtime/port-allocator.server.ts`
- [X] T015 [P] Implement port allocator tests for collision, occupied port, persist, and release cases in `src/features/ai-agent/runtime/__tests__/port-allocator.server.test.ts`
- [X] T016 [P] Implement Cloudflare DNS client with create/delete CNAME and 3-attempt backoff in `src/features/ai-agent/runtime/cloudflare-dns.server.ts`
- [X] T017 [P] Implement Cloudflare DNS client tests for idempotency, retry, and operator-attention failure in `src/features/ai-agent/runtime/__tests__/cloudflare-dns.server.test.ts`
- [X] T018 [P] Create runtime log tail helper for pm2 out/error logs and install fallback in `src/features/ai-agent/runtime/runtime-logs.server.ts`
- [X] T019 Register runtime dependencies in project service factory in `src/server/services/project-services.ts`

**Checkpoint**: Foundation ready; story work can proceed.

---

## Phase 3: User Story 1 - See Preview Runtime Progress After Generation (Priority: P1) 🎯 MVP

**Goal**: Generated projects install/start in background and UI shows correct state even after page reload.

**Independent Test**: Start a new project, reload during install/start, and verify UI resumes current state until preview is ready or failed.

### Tests for User Story 1

- [X] T020 [P] [US1] Add runtime orchestrator tests for install → start → running state transitions in `src/features/ai-agent/runtime/__tests__/runtime-orchestrator.server.test.ts`
- [X] T021 [P] [US1] Add runtime state server function tests for install/start/error payloads in `src/server/functions/__tests__/preview.test.ts`
- [X] T022 [P] [US1] Add project page polling/runtime rendering tests in `src/routes/__tests__/project-preview-runtime.test.tsx`

### Implementation for User Story 1

- [X] T023 [US1] Implement background install job and scheduleEnsureRunning workflow in `src/features/ai-agent/runtime/runtime-orchestrator.server.ts`
- [X] T024 [US1] Implement preview start path using port allocator, install status, pm2 start, and state writes in `src/features/ai-agent/runtime/runtime-orchestrator.server.ts`
- [X] T025 [US1] Refactor `getDevRuntimeState` and `startPreview` to call runtime orchestrator in `src/server/services/project-service.ts`
- [X] T026 [US1] Update server functions to return extended runtime state in `src/server/functions/preview.ts`
- [X] T027 [US1] Replace inline install/dev/fix waiting with fire-and-forget schedule call in `src/features/ai-agent/agent/agent-orchestrator.server.ts`
- [X] T028 [US1] Update UI polling and runtime state merge logic in `src/routes/projects/$projectId.tsx`
- [X] T029 [US1] Update runtime badges and failed/installing/starting display states in `src/routes/projects/$projectId.tsx`
- [X] T030 [US1] Wire recent log retrieval for failed runtime display in `src/server/functions/preview-logs.ts`

**Checkpoint**: US1 works independently; init preview progress is visible and reload-safe in local mode.

---

## Phase 4: User Story 2 - Use Production Preview URLs on VPS (Priority: P1)

**Goal**: Production previews resolve through `<projectId>-preview.myepis.cloud` and proxy HTTP/WS correctly; local mode remains loopback.

**Independent Test**: With production preview env set, start a project and open its subdomain externally; with env unset, confirm local loopback and no Cloudflare calls.

### Tests for User Story 2

- [X] T031 [P] [US2] Add production/local URL mode tests in `src/features/ai-agent/runtime/__tests__/runtime-orchestrator.preview-url.test.ts`
- [X] T032 [P] [US2] Add preview router HTTP and websocket proxy tests in `src/features/ai-agent/runtime/__tests__/preview-router.test.ts`
- [X] T033 [P] [US2] Add Cloudflare DNS integration contract tests with mocked API responses in `src/features/ai-agent/runtime/__tests__/cloudflare-dns.contract.test.ts`

### Implementation for User Story 2

- [X] T034 [US2] Generate production preview host and DNS intent during runtime scheduling in `src/features/ai-agent/runtime/runtime-orchestrator.server.ts`
- [X] T035 [US2] Create/delete per-project Cloudflare DNS record through DNS client in `src/features/ai-agent/runtime/runtime-orchestrator.server.ts`
- [X] T036 [US2] Implement Host-based HTTP and websocket proxy with lazy upstream lookup in `src/features/ai-agent/runtime/preview-router.server.ts`
- [X] T037 [US2] Register preview router startup only when production preview host is configured in `src/server/services/project-services.ts`
- [X] T038 [US2] Update generated storefront Vite template to read `VITE_PORT` and `VITE_PREVIEW_HOST` in `src/features/ai-agent/source/init-source.server.ts`
- [X] T039 [US2] Inject `VITE_PORT` and `VITE_PREVIEW_HOST` into pm2 env when starting previews in `src/features/ai-agent/runtime/pm2-driver.server.ts`
- [X] T040 [US2] Update quick runtime README for local vs production preview modes in `src/features/ai-agent/runtime/README.md`

**Checkpoint**: US2 works independently; production URL path and local fallback both work.

---

## Phase 5: User Story 3 - Recover Accurate Runtime State After Restarts (Priority: P1)

**Goal**: Runtime state after app restart matches pm2 state, not stale DB or lost in-memory process maps.

**Independent Test**: Start preview, restart app process, and verify state query reflects pm2 online/stopped/missing status.

### Tests for User Story 3

- [X] T041 [P] [US3] Add runtime reconciler tests for pm2 online/stopped/missing/deleted-project cases in `src/features/ai-agent/runtime/__tests__/runtime-reconciler.server.test.ts`
- [X] T042 [P] [US3] Add stuck install timeout tests in `src/features/ai-agent/runtime/__tests__/runtime-reconciler.install-timeout.test.ts`

### Implementation for User Story 3

- [X] T043 [US3] Implement boot reconciler for pm2 ↔ DB drift cleanup in `src/features/ai-agent/runtime/runtime-reconciler.server.ts`
- [X] T044 [US3] Implement stuck install sweep and failed-state marking in `src/features/ai-agent/runtime/runtime-reconciler.server.ts`
- [X] T045 [US3] Invoke runtime reconciler during server service initialization in `src/server/services/project-services.ts`
- [X] T046 [US3] Update `getDevRuntimeState` to derive live pm2 status on each call in `src/features/ai-agent/runtime/runtime-orchestrator.server.ts`
- [X] T047 [US3] Remove obsolete in-memory child process assumptions from `src/features/ai-agent/runtime/process-manager.server.ts` or mark it unused in `src/features/ai-agent/runtime/README.md`

**Checkpoint**: US3 works independently; app restarts no longer show stale running states.

---

## Phase 6: User Story 4 - Protect Preview Access (Priority: P2)

**Goal**: Only users authorized for a project receive preview tokens, and router denies unauthorized HTTP/WS traffic before proxying.

**Independent Test**: Load preview as authorized user and as anonymous/unauthorized user; verify only authorized traffic reaches runtime.

### Tests for User Story 4

- [X] T048 [P] [US4] Add preview token issue/verify/expiry tests in `src/features/ai-agent/runtime/__tests__/preview-token-service.server.test.ts`
- [X] T049 [P] [US4] Add router auth denial tests for HTTP and websocket in `src/features/ai-agent/runtime/__tests__/preview-router-auth.server.test.ts`
- [X] T050 [P] [US4] Add token refresh server function tests in `src/server/functions/__tests__/preview-token-refresh.test.ts`

### Implementation for User Story 4

- [X] T051 [US4] Implement project-scoped token issue/verify/refresh service in `src/features/ai-agent/runtime/preview-token-service.server.ts`
- [X] T052 [US4] Add preview token refresh route/server function in `src/routes/api/projects/$projectId/preview-token-refresh.ts`
- [X] T053 [US4] Enforce token validation before HTTP proxy and WS upgrade in `src/features/ai-agent/runtime/preview-router.server.ts`
- [X] T054 [US4] Refresh preview token from project page while preview tab is active in `src/routes/projects/$projectId.tsx`
- [X] T055 [US4] Wire token service dependency and authorization checks in `src/server/services/project-services.ts`

**Checkpoint**: US4 works independently; preview subdomains are non-public.

---

## Phase 7: User Story 5 - Keep VPS Resource Usage Bounded (Priority: P2)

**Goal**: Running previews never exceed cap; stopped previews resume on valid request.

**Independent Test**: Configure cap below number of opened projects and confirm least-recently-accessed eviction and lazy resume.

### Tests for User Story 5

- [X] T056 [P] [US5] Add LRU eviction tests in `src/features/ai-agent/runtime/__tests__/runtime-orchestrator.lru.test.ts`
- [X] T057 [P] [US5] Add lazy resume request dedupe tests in `src/features/ai-agent/runtime/__tests__/preview-router.lazy-resume.test.ts`

### Implementation for User Story 5

- [X] T058 [US5] Implement concurrent preview cap enforcement and LRU selection in `src/features/ai-agent/runtime/runtime-orchestrator.server.ts`
- [X] T059 [US5] Update `lastAccessedAt` on authorized router traffic in `src/features/ai-agent/runtime/preview-router.server.ts`
- [X] T060 [US5] Implement lazy resume with per-project dedupe and 30-second timeout in `src/features/ai-agent/runtime/preview-router.server.ts`
- [X] T061 [US5] Add idle timeout eligibility handling in `src/features/ai-agent/runtime/runtime-orchestrator.server.ts`
- [X] T062 [US5] Surface stopped/resuming states in preview UI in `src/routes/projects/$projectId.tsx`

**Checkpoint**: US5 works independently; resource cap and resume behavior are testable.

---

## Phase 8: User Story 6 - Store Project Workspaces Outside Deploy Directory (Priority: P2)

**Goal**: Production workspaces live under `PROJECTS_ROOT` or `/var/bin/projects`, and delete removes workspace while keeping soft-deleted DB row.

**Independent Test**: Start app with/without `PROJECTS_ROOT` in local and production mode; verify workspace paths and delete behavior.

### Tests for User Story 6

- [X] T063 [P] [US6] Add workspace path integration tests for local/prod/env defaults in `src/agent/__tests__/project-workspace-service.paths.test.ts`
- [X] T064 [P] [US6] Add delete teardown tests for workspace removal, DNS removal, pm2 delete, port release, and soft-delete row in `src/server/services/__tests__/project-delete-preview-teardown.test.ts`

### Implementation for User Story 6

- [X] T065 [US6] Integrate workspace root helper into all workspace creation/read paths in `src/agent/project-workspace-service.ts`
- [X] T066 [US6] Implement preview teardown orchestration for delete in `src/features/ai-agent/runtime/runtime-orchestrator.server.ts`
- [X] T067 [US6] Call preview teardown from project delete flow in `src/server/services/project-service.ts`
- [X] T068 [US6] Release allocated port and delete Cloudflare DNS record during teardown in `src/features/ai-agent/runtime/runtime-orchestrator.server.ts`
- [X] T069 [US6] Remove project workspace folder while preserving soft-deleted DB record in `src/server/services/project-service.ts`

**Checkpoint**: US6 works independently; production data does not live in repo and delete cleans runtime resources.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Contract consistency, docs, cleanup, validation.

- [ ] T070 [P] Update runtime documentation with module responsibilities and failure modes in `src/features/ai-agent/runtime/README.md`
- [ ] T071 [P] Update operator setup notes in `specs/016-preview-runtime-pm2/quickstart.md`
- [ ] T072 [P] Verify UI styling changes follow `DESIGN.md` tokens in `src/routes/projects/$projectId.tsx`
- [ ] T073 Remove dead references to old `ProcessManager` runtime path in `src/server/services/project-services.ts`
- [ ] T074 Run targeted tests for runtime modules with `pnpm vitest src/features/ai-agent/runtime src/server/functions src/agent`
- [ ] T075 Run full validation with `pnpm test` or repository equivalent from `package.json`
- [ ] T076 Run formatter/linter with repository configured command from `package.json`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 Setup → Phase 2 Foundation.
- Phase 2 Foundation blocks all user stories.
- US1, US2, US3 are P1 and should be completed before P2 stories.
- US4 depends on US2 router surface and can start after T036.
- US5 depends on US2 router and US3 pm2 truth path.
- US6 depends on Phase 1 path helper and Phase 2 orchestrator foundation.
- Polish runs after all selected stories.

### User Story Dependencies

```text
US1 (runtime progress) ─┬─> US2 (production URL)
                        └─> US3 (restart recovery)
US2 ──> US4 (preview auth)
US2 + US3 ──> US5 (resource cap + lazy resume)
US1 + Foundation ──> US6 (workspace root + teardown)
```

### MVP Scope

MVP = Phase 1 + Phase 2 + US1. This delivers reload-safe install/start state in local mode and removes dependency on agent stream lifecycle.

### Parallel Opportunities

- T002, T003, T004 can run in parallel.
- T012/T013, T014/T015, T016/T017, T018 can run in parallel after T008-T010 are stable.
- US1 tests T020-T022 can run in parallel before implementation.
- US2 tests T031-T033 can run in parallel; T036 can proceed once router contract is understood.
- US4 token service (T051) and route tests (T050) can proceed after foundational auth patterns are available.
- US6 path tests (T063) can run independently from teardown tests (T064).

### Parallel Example: US1

```text
Agent A: T020 + T023 + T024 in src/features/ai-agent/runtime/
Agent B: T021 + T025 + T026 in src/server/
Agent C: T022 + T028 + T029 in src/routes/projects/$projectId.tsx
```

### Parallel Example: US2

```text
Agent A: T031 + T034 + T035 in runtime-orchestrator/cloudflare-dns
Agent B: T032 + T036 + T037 in preview-router/service registration
Agent C: T038 + T039 + T040 in template/pm2 docs
```

### Parallel Example: US4

```text
Agent A: T048 + T051 in preview-token-service
Agent B: T049 + T053 in preview-router auth
Agent C: T050 + T052 + T054 in route/UI token refresh
```

---

## Implementation Strategy

1. Deliver MVP first: setup, foundation, US1 local reload-safe preview state.
2. Add production networking: US2 Cloudflare DNS + router + Vite HMR env.
3. Add recovery: US3 pm2 truth and boot reconcile.
4. Add security: US4 preview tokens for HTTP/WS.
5. Add operations: US5 resource cap/lazy resume and US6 workspace/teardown.
6. Finish with docs, cleanup, and full validation.
