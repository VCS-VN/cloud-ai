# Research: Multi-Message Agent Runs

**Feature**: [021-multi-message-agent-runs](./spec.md)
**Date**: 2026-05-29

Phần lớn quyết định kỹ thuật đã được giải quyết qua grill session (xem chat history). File này tổng hợp lại các quyết định + alternatives đã consider để làm reference.

## Decision 1: Persistence model — multi-message per run

**Decision**: 1 user prompt → 1 `agent_runs` row → N `project_messages` rows (kind: plan / answer / clarification / error / review_required) + 1 skeleton ephemeral.

**Rationale**:
- User explicitly muốn "1 prompt có nhiều agent message" — model A (mỗi milestone = 1 row trong `project_messages`) khớp đúng intent.
- Tận dụng pagination/cursor hiện tại (`beforeCreatedAt + beforeId`) — không cần thiết kế ordering riêng.
- Reload tự nhiên hiển thị đúng vì messages đã persist trong cùng bảng list view dùng.

**Alternatives considered**:
- **B. Mỗi run = 1 row, milestones là JSON `steps[]` trong cột.** Bị từ chối: phá pagination theo createdAt, render path khác với answer text, query "list messages" trở nên phức tạp.
- **C. Bảng riêng `agent_message_steps` JOIN với agent message.** Bị từ chối: thêm complexity normalization không đáng giá so với A.

## Decision 2: Run identifier — cột `runId` trên project_messages

**Decision**: Thêm cột `run_id text NULL` (+ index `(project_id, run_id)`) trên `project_messages`. Mọi message agent của cùng 1 run share `runId`. User message không cần `runId` (set NULL hoặc set bằng runId của run gốc — chọn không set vì user message thuộc về user input, không phải run output).

**Rationale**:
- Query "lấy messages của run X" = single `WHERE run_id = ?`.
- Stop/retry chỉ cần `runId`.
- Đơn giản hơn parentMessageId chain (phải đệ quy hoặc tự build adjacency).

**Alternatives considered**:
- **`parentMessageId` chain.** Bị từ chối: phải đệ quy.

## Decision 3: Reuse `agent_runs` table

**Decision**: Reuse bảng `agent_runs` hiện có. Migration: drop `message_id`, add `retry_of_run_id text NULL`, add `reasoning_effort text NULL`, `plan_mode boolean NOT NULL DEFAULT false`.

**Rationale**:
- `agent_runs` đã đúng concept (run = atomic agent processing unit) — chỉ cần đổi cardinality 1-1 → 1-N với messages.
- Repository (`PgAgentRunRepository`) reuse được phần lớn.
- Pre-prod cho phép drop & recreate, không cần backfill cẩn thận.

**Alternatives considered**:
- **Tạo bảng mới `message_runs` song song với `agent_runs`.** Bị từ chối: dual concept "run" trong codebase confusing.
- **Drop hẳn `agent_runs`, gom run state vào `project_messages`.** Bị từ chối: mất grouping anchor; "tất cả run của project" phải DISTINCT runId — chậm.

## Decision 4: Kind enum — 5 giá trị (đã loại understanding + changes)

**Decision**: `kind: 'plan' | 'answer' | 'clarification' | 'error' | 'review_required'`. Chỉ set khi `role='agent'`. NULL cho user message.

**Rationale**:
- `understanding` rephrase prompt user → duplicate khi đọc lại history → chỉ live trong skeleton ephemeral.
- `changes` ban đầu được đề xuất nhưng user explicit "hiện tại không cần show file changes" → bỏ. Plan milestone là indicator duy nhất show file context (UI v1 hide list).
- 5 kind đủ cover mọi outcome có ý nghĩa: kế hoạch, câu trả lời, hỏi lại, lỗi, cần review.

**Alternatives considered**:
- **6 kind (giữ understanding hoặc changes).** Bị từ chối qua grill: chat history phình, redundant với answer/skeleton.
- **3 kind (gộp clarification + error + review_required thành 1 "interrupt").** Bị từ chối: visual distinction (badge ❓/❌/⚠) là user value rõ ràng.

## Decision 5: Content shape — pure text/markdown, no metadata jsonb

**Decision**: Mỗi message lưu `content` là plain markdown text. Không thêm cột `metadata jsonb`. Plan content có format chuẩn (summary + file list) nhưng v1 client custom render hide file list.

**Rationale**:
- User chọn A (pure text) trong grill — đơn giản, không tăng schema surface.
- Future flip "show file list" = client-only change (data đã sẵn trong content).
- Tránh duplicate truth (content vs metadata).

**Alternatives considered**:
- **B. text content + structured `metadata jsonb`.** Bị từ chối: thêm cột không cần.
- **C. Mỗi kind 1 cột riêng.** Bị từ chối: schema phình.

**Trade-off accepted**: Nếu sau này cần rich UI (vd: click file path → mở file), parse markdown ngược fragile. Lúc đó migrate add `metadata jsonb` được (pre-prod).

## Decision 6: Lifecycle model — Hybrid C (skeleton live + milestones append-only)

**Decision**: 1 skeleton bubble ephemeral ở cuối list, label đổi theo phase đang chạy. Milestones append-only phía trên skeleton. Skeleton biến mất khi run terminal hoặc khi có skeleton mới (replace).

**Rationale**:
- Append-only đơn giản.
- Skeleton là single live indicator, dễ recover khi reload.
- Mapping: milestones = persist messages, skeleton = derived từ event reducer state.

**Alternatives considered**:
- **A. Skeleton tách biệt + milestone append.** Bị từ chối: 2 vùng UI tách biệt rối.
- **B. Mỗi milestone có pre-skeleton riêng (slot model).** Bị từ chối: phase có thể skip/lặp → slot mapping phức tạp.

## Decision 7: SSE protocol — 2 channels riêng

**Decision**: Run channel `/api/projects/:projectId/runs/:runId/stream` (lifetime = 1 run) + Runtime channel `/api/projects/:projectId/runtime/stream` (lifetime = page mount). Cả 2 multi-subscriber fan-out.

**Rationale**:
- Dev runtime là project-level state, lifetime khác run.
- Tách channel giúp run.completed đóng đúng channel của nó, runtime tiếp tục emit dev_install dài hơn.
- Multi-subscriber cần để support reload + multi-tab.

**Alternatives considered**:
- **1 channel chung, fan-out theo prefix event type.** Bị từ chối: SSE close timing rối khi run terminal nhưng dev events còn.
- **Single-subscriber giữ logic hiện tại.** Bị từ chối: tab thứ 2 reload làm tab 1 bị abort — UX tệ.
- **Persistent event log table.** Bị từ chối: in-memory queue đủ; pre-prod không cần audit trail durable.

## Decision 8: Stop semantics — explicit only, idempotent

**Decision**: `POST /runs/:runId/stop` chỉ abort khi user click explicitly. Subscriber disconnect (đóng tab, navigate away) KHÔNG abort run. Idempotent — gọi 2 lần trên run terminal trả 200 OK no-op.

**Rationale**:
- Reload không nên hủy run đang chạy.
- Ref-counting subscriber có race condition (reload làm count tạm về 0).
- Idempotent đơn giản UI logic — không cần handle "run đã terminal".

**Alternatives considered**:
- **Ref-count subscribers.** Bị từ chối: edge case reload.

## Decision 9: Retry behavior R1 — new run, retain old

**Decision**: Retry tạo runId mới với `retry_of_run_id = oldRunId`. KHÔNG tạo user message mới (reuse user message gốc). Run cũ (failed status + milestones) giữ nguyên trong DB. Default copy options từ run cũ.

**Rationale**:
- Transparent: user thấy "thử 1 fail, thử 2 done" trong history.
- Distinct với "edit prompt + send mới" qua field `retry_of_run_id` (NULL nếu user prompt mới).
- Resume run cũ (R3) phức tạp + không reliable với LLM non-deterministic.

**Alternatives considered**:
- **R2. Replace run cũ (mark deleted/hidden).** Bị từ chối: mất history retry attempts.
- **R3. Resume run cũ.** Bị từ chối: state có thể đã apply 1 phần file changes; resume không deterministic.

## Decision 10: Optimistic UI

**Decision**: Client insert temp userMessage (id prefix `temp_`) + optimistic skeleton phase `'starting'` ngay khi user click send. POST settle → replace temp với real từ response. POST fail → rollback (remove temp + skeleton, restore composer text, error toast).

**Rationale**:
- UX <100ms feedback (SC-001) đòi hỏi optimistic.
- Prefix `temp_` dễ filter trong devtools, không collide với UUID v4 server tạo.
- Phase `'starting'` (client-only) là phase trung lập trước khi server emit phase thực.

**Alternatives considered**:
- **Wait for POST.** Bị từ chối: latency 50-200ms hiển thị.
- **Optimistic chỉ user message, skeleton chờ SSE.** Bị từ chối: có khoảng "blank" giữa user bubble và skeleton.

## Decision 11: Skeleton phases — 8 server-emit + 1 client-only

**Decision**: Server-emit phases: `understanding`, `planning`, `editing`, `installing`, `starting_preview`, `validating`, `repairing`, `responding`. Client-only: `starting` (cho optimistic state). Server throttle 200ms cùng phase, phase đổi → emit ngay.

**Rationale**:
- 8 phases cover tất cả AgentStreamEvent meaningful cho user.
- Throttle tránh spam SSE khi tool calls liên tiếp.
- `starting` client-only vì server không biết user đã click — chỉ client biết.

**Mapping AgentStreamEvent → SkeletonUpdate**:
| AgentStreamEvent | Phase |
|---|---|
| `thinking_started` | understanding |
| `plan_created` | planning (transient before milestone persist) |
| `source_generation_started`, `tool_call_requested` | editing (+ detail tool name sanitized) |
| `dev_install_started` | installing |
| `dev_starting` | starting_preview |
| `validation_started` | validating |
| `repair_started`, `dev_fix_attempt` | repairing |
| `assistant_message_delta` (đầu tiên) | responding |

## Decision 12: Stale resume — auto cleanup

**Decision**: Khi resume gặp runId không có trong memory map nhưng DB còn `processingStatus='processing'`, server tự update tất cả messages của run thành `'failed'`, project về `'idle'`, emit single `run.failed` event với code mới `RUN_INTERRUPTED` rồi đóng SSE.

**Rationale**:
- Server crash là edge case hiếm; client không cần code path riêng.
- Single point of truth: server cleanup, client xử lý hệt như run failed bình thường.

**Alternatives considered**:
- **Client handle stale (410 Gone).** Bị từ chối: thêm code path lạ trên client.
- **Persistent event log để resume thực sự.** Bị từ chối: over-engineering cho pre-prod scenario hiếm.

## Decision 13: Heartbeat — 15s server / 30s client / 1 retry

**Decision**: Server gửi `heartbeat` mỗi 15s trên cả 2 channels. Client timeout 30s không nhận event nào (kể cả heartbeat) → tự đóng và mở lại 1 lần. Retry fail → mark run failed local + error toast.

**Rationale**: 2× heartbeat interval là buffer đủ cho jitter network. 1 retry tránh infinite reconnect loop.

## Decision 14: Reducer client — RunUIState + ChatUIState

**Decision**:
```ts
type RunUIState = {
  runId: string;
  status: 'streaming' | 'completed' | 'failed' | 'stopped';
  skeleton: { phase: SkeletonPhase; label: string; detail?: string } | null;
  error?: { code: StreamErrorCode; message: string };
}

type ChatUIState = {
  messages: Message[];
  activeRun: RunUIState | null;
  runtime: DevRuntimeUIState;  // tách hẳn từ runtime channel
}
```

`run.completed/failed/stopped` → `activeRun = null` ngay (không delay).

**Rationale**: `runtime` tách hẳn vì lifetime khác. `activeRun = null` ngay đơn giản UI logic — answer message + skeleton biến mất tức thì khi terminal.

## Decision 15: Drop `agent_message_chunks` table + `sequence` field

**Decision**: Xóa hẳn bảng `agent_message_chunks`. Bỏ field `sequence` trong `message.delta` event.

**Rationale**:
- `message.content` đã được update đồng bộ với chunks save trong code hiện tại — chunks là duplicate.
- SSE strictly ordered → không cần `sequence` để reorder.
- Resume mid-stream chỉ cần `message.content` + tiếp tục append.

**Alternatives considered**:
- **Giữ chunks cho audit log.** Bị từ chối: console.info structured logs đủ cho v1.

## Decision 16: Visual grouping — subtle border-left per runId

**Decision**: Wrapper `<div data-run-group="<runId>" class="border-l border-[var(--app-border-soft)] pl-sm">` quanh tất cả agent messages cùng runId. User message KHÔNG include. Skeleton bubble KHÔNG include. Run 1 message vẫn render wrapper (consistency).

**Rationale**: Subtle visual cue (1px + indent nhẹ) giúp user nhận biết group mà không dominate UI.

**Alternatives considered**:
- **No grouping.** Bị từ chối: chat history sau N tương tác khó scan.
- **Bold border + background fill.** Bị từ chối: dominate UI, mâu thuẫn DESIGN.md subtle transitions.

## Decision 17: Composer state — type-free, send/stop toggle

**Decision**: Idle → nút send. Processing → nút stop replaces send (single point of control). User được gõ tự do mọi lúc — text persist qua run lifecycle.

**Rationale**:
- User không bị block typing khi đợi run dài.
- Single button (send/stop toggle) tránh scatter UI controls.

**Alternatives considered**:
- **Disable composer hoàn toàn.** Bị từ chối: UX tệ.
- **Stop button trong skeleton bubble.** Bị từ chối: scatter controls.

## Decision 18: Phasing — 5 phases tuần tự

**Decision**:
1. **P1 Schema & types**: Drizzle migration + update Message/Project/AgentRun types
2. **P2 Server core**: Services, repos, endpoints `/runs/*`, multi-subscriber fan-out, stale resume cleanup
3. **P3 Client protocol**: Reducer mới, useAgentStream rewrite, optimistic skeleton, SSE timeout/retry, runtime channel tách
4. **P4 Client UI**: MessageBubble per kind, plan custom render, visual grouping, skeleton bubble, composer state. Delete AgentEventTimeline
5. **P5 Polish**: Edge cases, cleanup unused code, perf check throttle

**Rationale**:
- Mỗi phase chạy được standalone (build + tests pass).
- Sequence từ schema → server → protocol → UI → polish — natural dependency.

**Alternatives considered**:
- **1 PR khổng lồ.** Bị từ chối: review khó, conflict cao.
- **Chia theo milestone kind (vertical slice).** Bị từ chối: mỗi PR đụng schema + server + client → conflict.

## Decision 19: Test strategy — phase b (rewrite tests)

**Decision**: Delete tests cũ + viết lại tests mới cho protocol mới. Không update tests cũ.

**Rationale**: Protocol cũ deprecate hoàn toàn — tests cũ assert behavior không còn tồn tại. Pre-prod không cần regression coverage cho behavior cũ.

## Decision 20: Permission/Auth — owner-only (out of scope deeper)

**Decision**: Reuse existing `userId` ownership check trong repositories. Không thêm permission layer mới.

**Rationale**: Multi-user collaboration out of scope v1. Owner-only đủ cho hiện tại.

## Open items (deferred to future versions)

- **Mobile responsive**: Chưa quyết. v2 sẽ adjust skeleton/composer cho viewport nhỏ.
- **i18n copy thống nhất Anh/Việt**: Code hiện mix. v2 sẽ thống nhất theo i18n strategy của project.
- **Empty states project chưa có run**: Composer + UI render gì khi history rỗng — sẽ giữ behavior hiện tại (composer + empty list).
- **Telemetry chi tiết**: console.info structured logs đủ v1. v2 có thể add metrics module nếu cần.

## Resolved unknowns

Tất cả `NEEDS CLARIFICATION` từ Technical Context đã resolve:
- Language/Version: TypeScript ES2022 / Node 20+
- Dependencies: confirmed từ package.json (Vite 5, React 18, TanStack, Drizzle, vitest, lucide-react, dompurify)
- Testing: vitest (đã có config + tests pattern)
- Performance goals: derived từ Success Criteria SC-001/003/006/010
- Scale: 1 user / project, ≤ 3 tabs concurrent
