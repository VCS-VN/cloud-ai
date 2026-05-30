# Quickstart: Multi-Message Agent Runs

**Feature**: [021-multi-message-agent-runs](./spec.md)
**Date**: 2026-05-29

Hướng dẫn dev verify feature đã hoạt động đúng sau khi implement. Mỗi phase có verify gate riêng.

## Prerequisites

```bash
pnpm install
# Postgres đang chạy (xem drizzle.config.ts cho connection)
```

## Phase verification gates

### P1: Schema & types

```bash
# Generate migration
pnpm drizzle-kit generate

# Apply (pre-prod: drop & recreate OK)
pnpm drizzle-kit push   # hoặc migrate script của project

# Build phải pass (types đã update)
pnpm tsc --noEmit
```

**Verify**:
- [ ] `agent_runs` có cột `retry_of_run_id`, `reasoning_effort`, `plan_mode`; KHÔNG còn `message_id`.
- [ ] `project_messages` có cột `run_id`, `kind`; có index `(project_id, run_id)`.
- [ ] `projects` có `active_run_id`; KHÔNG còn `active_agent_message_id`.
- [ ] Table `agent_message_chunks` đã bị drop.
- [ ] `pnpm tsc --noEmit` pass (không lỗi type ở `Message`, `Project`, `AgentRun`).

### P2: Server core

```bash
pnpm vitest run src/server/services/__tests__
pnpm vitest run src/server/repositories/__tests__
pnpm vitest run src/features/ai-agent/agent/__tests__
```

**Verify (unit/integration)**:
- [ ] `MessageService.createRun` tạo user message + agent run + set project processing.
- [ ] `MessageService.streamRun` map AgentStreamEvent → đúng SSE event (plan milestone, answer streaming, skeleton.update, run.completed).
- [ ] `MessageService.stopRun` idempotent — gọi 2 lần OK.
- [ ] `MessageService.retryRun` tạo run mới với `retryOfRunId`, KHÔNG tạo user message mới.
- [ ] Stale resume cleanup: runId không trong memory + DB processing → mark failed + RUN_INTERRUPTED.
- [ ] Multi-subscriber fan-out: 2 subscriber cùng runId nhận đủ events.
- [ ] `agent-event-to-skeleton` map đúng 8 phases.
- [ ] `agent-event-to-milestone` quyết định đúng (plan chỉ khi ≥1 file op; answer lazy; clarification/error/review_required đúng trigger).

**Manual smoke (curl)**:
```bash
# Tạo run
curl -X POST localhost:5173/api/projects/$PID/runs \
  -H 'Content-Type: application/json' \
  -d '{"content":"thêm dark mode toggle"}'
# → { runId, userMessage, streamUrl }

# Stream (xem events)
curl -N localhost:5173/api/projects/$PID/runs/$RID/stream
# → run.started, skeleton.update×N, message.created(plan), message.created(answer),
#   message.delta×N, message.completed, run.completed

# Stop (idempotent)
curl -X POST localhost:5173/api/projects/$PID/runs/$RID/stop
curl -X POST localhost:5173/api/projects/$PID/runs/$RID/stop   # no-op, vẫn 200
```

### P3: Client protocol

```bash
pnpm vitest run src/features/ai-agent/ui/__tests__
```

**Verify**:
- [ ] Reducer: `run.started` → activeRun streaming; `message.created` → push messages; `message.delta` → append; `run.completed` → activeRun=null.
- [ ] Optimistic skeleton: dispatch optimistic → phase 'starting' → `run.started` → phase update.
- [ ] SSE timeout: 30s no event → reconnect 1 lần.
- [ ] Runtime channel tách: `dev_*` events update `runtime` state, không động vào `activeRun`.

### P4: Client UI

```bash
pnpm vitest run src/components/projects/__tests__
pnpm dev   # mở browser
```

**Verify (component test + manual UI)**:
- [ ] `MessageBubble` render đúng per kind: answer/plan markdown, clarification ❓, error ❌, review_required ⚠.
- [ ] `PlanMessageContent` chỉ hiện summary line (file list ẩn v1).
- [ ] `SkeletonMessageBubble` hiện Loader2 + label, ở cuối list.
- [ ] Visual grouping: agent messages cùng runId có border-left subtle; user message không có; skeleton không trong wrapper.
- [ ] Composer: idle → send button; processing → stop button; gõ được mọi lúc.
- [ ] `AgentEventTimeline` đã xóa, không còn import.

**Manual golden path (browser)**:
1. Gửi prompt sửa code → thấy user bubble + skeleton ngay (<100ms).
2. Skeleton label đổi theo phase (understanding → planning → editing → responding).
3. Plan milestone xuất hiện (summary only).
4. Answer streaming text.
5. Run xong → skeleton biến mất, còn plan + answer với border group.
6. Reload → thấy đúng plan + answer (không skeleton).

**Manual edge cases**:
- [ ] Stop mid-run → skeleton "Stopping...", composer revert, run stopped, milestones giữ.
- [ ] Retry failed run → run mới, run cũ vẫn hiện.
- [ ] Reload mid-run → skeleton resume đúng phase, stream tiếp.
- [ ] Mở 2 tab cùng project khi run chạy → cả 2 nhận updates, không tab nào bị ngắt.
- [ ] Clarification → badge ❓, reply tạo run mới.

### P5: Polish

```bash
pnpm tsc --noEmit
pnpm vitest run          # toàn bộ test suite
pnpm lint                # ESLint (Constitution VIII)
pnpm build               # production build pass
```

**Verify**:
- [ ] Toàn bộ test pass.
- [ ] Không còn dead code: `formatUserFacingStatus` đã xóa, `agent_message_chunks` references sạch, `AgentEventTimeline` xóa.
- [ ] Skeleton throttle 200ms cùng phase hoạt động (không spam SSE — kiểm qua network tab khi tool calls liên tiếp).
- [ ] LLM không liệt kê file paths trong answer text (kiểm prompt + sample output).
- [ ] ESLint pass, import alias `@/` tuân thủ (Constitution X).

## Success criteria mapping (verify cuối)

| SC | Cách verify |
|---|---|
| SC-001 (<100ms optimistic) | DevTools Performance: từ click đến paint user bubble |
| SC-002 (no blank >2s) | Quan sát skeleton label liên tục trong run sửa code |
| SC-003 (reload ≤3s) | Reload mid-run, đo thời gian state khôi phục |
| SC-004 (≤2 bubbles/run) | Run thường có plan + answer; text-only có 1 |
| SC-005 (0% stuck) | Kill server mid-run, reload → run failed RUN_INTERRUPTED, project idle |
| SC-006 (stop ≤500ms) | Click stop, đo UI revert |
| SC-007 (consistency) | Realtime view vs reload view khớp 100% |
| SC-008 (multi-tab) | 2 tab, cả 2 nhận events |
| SC-010 (bandwidth ≤+30%) | So sánh SSE payload size trước/sau (throttle + no sequence) |

## Rollback

Pre-prod: nếu cần rollback, checkout branch cũ + `drizzle-kit push` lại schema cũ. Data drop OK (không có prod data).
