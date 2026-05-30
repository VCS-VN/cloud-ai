# SSE Events Contract: Multi-Message Agent Runs

**Feature**: [021-multi-message-agent-runs](../spec.md)
**Date**: 2026-05-29

2 SSE channels độc lập. Mỗi event serialize theo SSE format:
```text
event: <event.type>
data: <JSON.stringify(event)>

```
(2 newline kết thúc mỗi event). Content qua `redactJson` để sanitize secrets trước khi gửi (reuse existing redactor).

---

## Run Channel

**Endpoint**: `GET /api/projects/:projectId/runs/:runId/stream`
**Lifetime**: 1 run (từ `run.started` đến terminal event).
**Multi-subscriber**: server giữ `Set<EnqueueFn>` per `runId` key. Mỗi event encode 1 lần, push tới mọi subscriber.

### Event ordering guarantee

- `run.started` luôn là event đầu tiên (khi subscriber connect, hoặc replay từ buffer).
- Terminal event (`run.completed` / `run.failed` / `run.stopped`) luôn là event cuối, sau đó server đóng channel.
- KHÔNG guarantee thứ tự giữa các `kind` của `message.created` (server emit theo thứ tự event agent xảy ra). Client render theo `createdAt` ASC.
- `message.delta` chỉ áp dụng cho message `kind=answer`, luôn nằm giữa `message.created`(answer) và `message.completed`(answer).
- `skeleton.update` có thể xen kẽ bất kỳ lúc nào giữa `run.started` và terminal.

### Events

#### `run.started`
```jsonc
{ "type": "run.started", "runId": "string", "projectId": "string" }
```
Emit khi: subscriber connect (live) hoặc đầu replay buffer. Client: khởi tạo `activeRun = { runId, status: 'streaming', skeleton: null }`.

#### `message.created`
```jsonc
{
  "type": "message.created",
  "runId": "string",
  "messageId": "string",
  "kind": "plan|answer|clarification|error|review_required",
  "content": "string",                              // đã có sẵn nội dung; với answer = "" ban đầu
  "processingStatus": "completed|streaming",        // answer=streaming, còn lại=completed
  "createdAt": "ISO8601"
}
```
Emit khi: 1 milestone được persist vào DB (write-through: DB write trước, emit sau). Client: insert message vào `messages[]` theo createdAt.

#### `message.delta`
```jsonc
{ "type": "message.delta", "runId": "string", "messageId": "string", "delta": "string" }
```
Emit khi: answer message nhận text chunk. Client: append `delta` vào content của message tương ứng. KHÔNG có field `sequence` (SSE ordered).

#### `message.completed`
```jsonc
{ "type": "message.completed", "runId": "string", "messageId": "string", "content": "string" }
```
Emit khi: answer streaming xong. Client: set message.processingStatus='completed', set final content.

#### `skeleton.update`
```jsonc
{
  "type": "skeleton.update",
  "runId": "string",
  "phase": "understanding|planning|editing|installing|starting_preview|validating|repairing|responding",
  "label": "string",                // user-facing, sanitized
  "detail": "string"                // optional, sanitized
}
```
Emit khi: agent chuyển phase, hoặc detail đổi trong cùng phase (throttle 200ms cùng phase; phase đổi → emit ngay). Client: `activeRun.skeleton = { phase, label, detail }` (replace skeleton hiện tại). KHÔNG có phase `'starting'` (client-only).

#### `run.completed`
```jsonc
{ "type": "run.completed", "runId": "string", "projectProcessingStatus": "idle" }
```
Emit khi: agent done thành công. Client: `activeRun = null` ngay (skeleton biến mất). Terminal.

#### `run.failed`
```jsonc
{
  "type": "run.failed",
  "runId": "string",
  "projectProcessingStatus": "idle",
  "error": { "code": "PROVIDER_STREAM_FAILED|RUN_INTERRUPTED|...", "message": "string" }
}
```
Emit khi: run fail unrecoverable hoặc stale cleanup. Client: store error, `activeRun = null`. Terminal. (Error milestone — nếu có — đã được emit qua `message.created` trước đó.)

#### `run.stopped`
```jsonc
{ "type": "run.stopped", "runId": "string", "projectProcessingStatus": "idle" }
```
Emit khi: user stop. Client: `activeRun = null`. Terminal. (Answer message — nếu có — giữ partial content, status='stopped'.)

#### `heartbeat`
```jsonc
{ "type": "heartbeat", "runId": "string" }
```
Emit mỗi 15s. Client: reset timeout counter (30s). No-op khác.

### Run channel state machine (client)

```text
[connect] → run.started → activeRun = {streaming, skeleton:null}
              │
              ├─ message.created(plan)      → messages.push, skeleton vẫn live
              ├─ skeleton.update(phase)     → activeRun.skeleton = {...}
              ├─ message.created(answer)    → messages.push (streaming)
              ├─ message.delta × N          → append content
              ├─ message.completed(answer)  → message status completed
              ├─ heartbeat                  → reset timeout
              │
              └─ run.completed|failed|stopped → activeRun = null  [TERMINAL, close]
```

---

## Runtime Channel

**Endpoint**: `GET /api/projects/:projectId/runtime/stream`
**Lifetime**: page mount → unmount (project-level, không gắn run).
**Multi-subscriber**: server giữ `Set<EnqueueFn>` per `projectId` + latest runtime state snapshot.

### Events

Reuse existing `DevRuntimeEvent` types (từ `runtime-events.ts`):

#### `dev_install_started` / `dev_install_completed` / `dev_install_failed`
```jsonc
{ "type": "dev_install_started", "projectId": "string" }
{ "type": "dev_install_completed", "projectId": "string", "durationMs": 1234 }
{ "type": "dev_install_failed", "projectId": "string", "error": "string" }
```

#### `dev_starting` / `dev_ready`
```jsonc
{ "type": "dev_starting", "projectId": "string" }
{ "type": "dev_ready", "projectId": "string", "previewUrl": "string", "port": 5173 }
```

#### `dev_error`
```jsonc
{ "type": "dev_error", "projectId": "string", "error": "string", "tier": "code|config|system" }
```

#### `dev_fix_attempt` / `dev_fix_applied` / `dev_fix_failed`
```jsonc
{ "type": "dev_fix_attempt", "projectId": "string", "attempt": 1, "error": "string" }
{ "type": "dev_fix_applied", "projectId": "string", "changedFiles": ["..."] }
{ "type": "dev_fix_failed", "projectId": "string", "reason": "string" }
```

#### `heartbeat`
```jsonc
{ "type": "heartbeat" }
```

### Runtime channel notes

- Client connect → nhận snapshot state hiện tại (nếu dev server đang chạy) rồi live updates.
- Lifetime độc lập agent run: dev install có thể tiếp tục emit sau khi `run.completed`.
- Client `runtime` state (trong ChatUIState) chỉ update từ channel này, KHÔNG từ run channel.

---

## Client reconnect / timeout behavior (cả 2 channels)

- Client mở EventSource. Nếu 30s không nhận event nào (kể cả heartbeat) → đóng và mở lại 1 lần.
- Retry connect fail → run channel: mark run failed local + error toast. Runtime channel: silent retry sau (dev runtime không critical).
- Reload trang: client đọc `project.activeRunId`. Nếu có → mở run channel (replay từ buffer). Luôn mở runtime channel khi vào page.

## Removed events (từ protocol cũ)

| Event cũ | Lý do bỏ |
|---|---|
| `message.started` | Thay bằng `message.created` (carry đủ info) |
| `message.failed` | Terminal là run-level (`run.failed`) |
| `message.stopped` | Terminal là run-level (`run.stopped`) |
| `message.delta.sequence` field | SSE ordered, không cần |
