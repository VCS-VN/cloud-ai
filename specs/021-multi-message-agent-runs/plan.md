# Implementation Plan: Multi-Message Agent Runs With Skeleton & Milestone Messages

**Branch**: `021-multi-message-agent-runs` | **Date**: 2026-05-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/021-multi-message-agent-runs/spec.md`

## Summary

Tái cấu trúc luồng message agent: 1 user prompt → 1 `agent_runs` row → N `project_messages` (kind: plan / answer / clarification / error / review_required) + 1 skeleton ephemeral. Thay protocol SSE từ message-based sang run-based, tách kênh runtime project-level. Refactor `MessageService`, repositories, endpoints, client reducer + UI để khớp model mới. Pre-prod nên migration drop & recreate, không backfill.

Tech approach gói gọn: **structured streaming protocol + per-kind milestone persistence + ephemeral skeleton bubble + multi-subscriber fan-out + optimistic client + 5-phase rollout**.

## Technical Context

**Language/Version**: TypeScript (project tsconfig target ES2022, Node ≥ 20 cho server-side)

**Primary Dependencies**:
- Vite 5 (bundler + dev server)
- React 18 + TanStack Router + TanStack Query
- Drizzle ORM + drizzle-kit (migrations)
- postgres-js (driver)
- DOMPurify (qua `src/lib/dumprify.ts`)
- lucide-react (icon)
- vitest + @testing-library/react (testing)

**Storage**: PostgreSQL (Drizzle schema). Tables impacted: `agent_runs`, `project_messages`, `projects`. Drop: `agent_message_chunks`.

**Testing**: vitest unit + integration tests (`__tests__` folder song song với source). Mocked AgentOrchestrator cho integration.

**Target Platform**: Browser (desktop) + Node server (Vite SSR / TanStack Start API routes). Mobile out of scope v1.

**Project Type**: Web application — single repo với client + server + shared types trong `src/`.

**Performance Goals**:
- Optimistic UI render < 100ms từ click send (FR-024, SC-001)
- Skeleton update propagation < 200ms từ event arrive
- SSE bandwidth không tăng > 30% so với hiện tại (SC-010)
- Reload mid-run khôi phục state ≤ 3s (SC-003)
- Stop click → UI revert ≤ 500ms (SC-006)

**Constraints**:
- Multi-subscriber fan-out không lock memory > 100KB/run (~200 events × 500 bytes ceiling).
- Heartbeat 15s server, 30s client timeout, 1 retry trước khi fail local.
- Server throttle skeleton.update 200ms cùng phase.
- Stale resume cleanup phải atomic — không để run "kẹt" processing sau server restart.

**Scale/Scope**:
- Owner-only (1 user / project) → fan-out subscriber count thực tế ≤ 3 tabs.
- 5 phases tuần tự, mỗi phase build pass + tests pass + manual smoke.
- ~16 files modified, ~6 files deleted, ~10 files created.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Note |
|---|---|---|
| I. Code flow rõ ràng (UI/service/repo/db) | PASS | Plan tách rõ 4 tầng: UI client (`components/`, `routes/`, `features/ai-agent/ui/`) → service (`server/services/message-service.ts`) → repository (`server/repositories/*`) → DB schema (`db/schema/*`). |
| II. Test cho business rule | PASS | Strategy "phase b" — delete tests cũ, viết lại từ đầu cho protocol mới. Cover: run lifecycle, agent_runs CRUD, stop/retry, resume cleanup, multi-subscriber fan-out, reducer transitions, optimistic skeleton, MessageBubble per kind. |
| III. API trả lỗi nhất quán | PASS | Reuse `StreamErrorCode` enum, thêm `RUN_INTERRUPTED`. POST `/runs` reject với mã `PROJECT_ALREADY_PROCESSING`. Stop idempotent 200 OK no-op. |
| IV. Không over-engineer | PASS | Bỏ `understanding` & `changes` milestone, bỏ `agent_message_chunks` table, bỏ field `sequence`, không thêm `metadata jsonb` — chỉ giữ những gì user thực sự cần. |
| V. UX & Design tokens | PASS | Border trái dùng `--app-border-soft` (đã có trong DESIGN.md). Skeleton: Loader2 từ lucide + `--app-icon-muted`. Không hardcode màu. |
| VI. Auth/permission | PASS | Reuse existing `userId` ownership check trong repository methods. AI Agent không sửa `.env`. |
| VII. Code Review (graph) | PASS | Sẽ áp dụng `code-graph-review` trước review chi tiết khi implement xong từng phase. |
| VIII. Code formatting | PASS | ESLint sẽ chạy sau mỗi phase (đã có config). |
| IX. JSON type convention | PASS | Không thêm cột JSON mới (content/kind là `text`, `plan_mode` là `boolean`). |
| X. Import alias `@/`, `@app/` | PASS | Tất cả import giữa folder dùng `@/`. Tests cũng tuân theo. |

**Constitution check: PASS — không có violations cần justify.**

## Project Structure

### Documentation (this feature)

```text
specs/021-multi-message-agent-runs/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── http-endpoints.md
│   └── sse-events.md
└── checklists/
    └── requirements.md  # Quality checklist (already exists)
```

### Source Code (repository root)

```text
src/
├── db/
│   ├── schema/
│   │   ├── agent-runs.schema.ts            # MODIFY: drop messageId, add retryOfRunId/reasoningEffort/planMode
│   │   ├── project-messages.schema.ts      # MODIFY: add runId + index, add kind
│   │   ├── projects.schema.ts              # MODIFY: drop activeAgentMessageId, add activeRunId
│   │   ├── agent-message-chunks.schema.ts  # DELETE
│   │   └── index.ts                        # MODIFY: remove agent-message-chunks export
│   └── migrations/                         # NEW migration file (drizzle generate)
├── shared/
│   └── project-types.ts                    # MODIFY: Message.kind/runId, Project.activeRunId,
│                                           #   MessageStreamEvent → RunStreamEvent + RuntimeStreamEvent,
│                                           #   add SkeletonPhase enum, RunUIState type
├── server/
│   ├── repositories/
│   │   ├── agent-run-repository.ts         # MODIFY: drop messageId getters, add retryOfRunId/options
│   │   ├── message-repository.ts           # MODIFY: add findByRunId, drop chunk methods
│   │   └── project-repository.ts           # MODIFY: rename activeAgentMessageId → activeRunId
│   ├── services/
│   │   ├── message-service.ts              # REFACTOR: createRun/streamRun/stopRun/retryRun
│   │   └── runtime-service.ts              # NEW: project-level runtime broadcast service
│   └── functions/
│       ├── project-runs.ts                 # NEW: server functions cho run CRUD + stream
│       ├── project-runtime.ts              # NEW: runtime channel server function
│       ├── project-message-stream.ts       # MODIFY: refactor sang run-stream + runtime-stream registries
│       └── projects.ts                     # MODIFY: đổi activeAgentMessageId field
├── routes/
│   ├── api/
│   │   └── projects/
│   │       └── $projectId/
│   │           ├── runs/                   # NEW route group
│   │           │   ├── index.ts            # POST /runs
│   │           │   └── $runId/
│   │           │       ├── stream.ts       # GET /runs/:id/stream
│   │           │       ├── stop.ts         # POST /runs/:id/stop
│   │           │       └── retry.ts        # POST /runs/:id/retry
│   │           ├── runtime/
│   │           │   └── stream.ts           # NEW: GET /runtime/stream
│   │           └── messages/               # KEEP /messages list endpoint, DELETE /:id/stream + /:id/stop
│   └── projects/
│       └── $projectId.tsx                  # MODIFY: composer state, optimistic, 2 SSE channels
├── features/ai-agent/
│   ├── agent/
│   │   ├── user-facing-presenter.ts        # MODIFY: keep sanitize*, drop formatUserFacingStatus
│   │   ├── agent-event-to-skeleton.ts      # NEW: map AgentStreamEvent → SkeletonUpdate decision
│   │   ├── agent-event-to-milestone.ts     # NEW: map AgentStreamEvent → milestone insert decision
│   │   ├── agent-orchestrator.server.ts    # MODIFY: emit run-based events instead of text deltas
│   │   └── agentic-prompts.server.ts       # MODIFY: instruct LLM not to list file paths in answer
│   └── ui/
│       ├── agent-event-reducer.ts          # REWRITE: new RunUIState/ChatUIState model
│       ├── use-agent-stream.ts             # REWRITE: 2 channels, timeout, retry, optimistic
│       ├── agent-event-timeline.tsx        # DELETE: replaced by skeleton bubble
│       └── streaming-text-panel.tsx        # KEEP/MINOR: still useful for answer streaming
├── components/
│   └── projects/
│       ├── MessageBubble.tsx               # MODIFY: per-kind render switch
│       ├── ProjectMessagesPanel.tsx        # MODIFY: visual grouping wrapper per runId
│       ├── PlanMessageContent.tsx          # NEW: custom plan render (hide file list v1)
│       ├── SkeletonMessageBubble.tsx       # NEW: skeleton bubble với phase label
│       └── ProjectComposer.tsx             # MODIFY (or inline in route): send/stop button toggle
└── lib/
    └── dumprify.ts                         # KEEP unchanged (allowlist sufficient cho 5 kinds)

src/server/services/__tests__/
├── message-service.run-lifecycle.test.ts   # NEW
├── message-service.stop-retry.test.ts      # NEW
├── message-service.resume-cleanup.test.ts  # NEW
└── runtime-service.test.ts                 # NEW

src/server/repositories/__tests__/
├── agent-run-repository.test.ts            # REWRITE
├── message-repository.test.ts              # MODIFY: kind/runId queries
└── project-repository.test.ts              # MODIFY: activeRunId

src/features/ai-agent/agent/__tests__/
├── agent-event-to-skeleton.test.ts         # NEW
└── agent-event-to-milestone.test.ts        # NEW

src/features/ai-agent/ui/__tests__/         # NEW dir
├── agent-event-reducer.test.ts             # NEW
└── use-agent-stream.test.ts                # NEW

src/components/projects/__tests__/          # NEW dir
├── MessageBubble.test.tsx                  # NEW
├── ProjectMessagesPanel.test.tsx           # NEW
├── PlanMessageContent.test.tsx             # NEW
└── SkeletonMessageBubble.test.tsx          # NEW
```

**Structure Decision**: Single-repo web application với client + server + shared types ở `src/`. Tổ chức theo feature folders (`features/ai-agent/`) cho domain logic, layered folders (`db/`, `server/`, `components/`, `routes/`) cho infrastructure. Tests song song với source theo convention `__tests__/` (đã có sẵn). Không tách thêm package — tăng complexity không cần thiết (Principle IV).

## Complexity Tracking

Không có violations. Plan giữ minimal:

- 5 milestone kinds thay vì 7 (đã loại understanding + changes — đơn giản hơn)
- 1 cột `kind` text + 1 cột `run_id` text thay vì JSON metadata structured (Principle IV, IX)
- 2 SSE channels riêng biệt — cần thiết vì lifetime khác nhau (run vs project) — không phải over-engineer
- Multi-subscriber fan-out — cần để support reload + multi-tab (FR-018, FR-021); single-subscriber cũ là code smell hiện tại

Không có item nào cần justify trong bảng complexity tracking.
